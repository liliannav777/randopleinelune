# Rando Pleine Lune Lyon Beaujolais

Application mobile publique (iOS et Android) pour découvrir les randonnées nocturnes, réserver une place,
recevoir une confirmation et présenter un QR code à l'arrivée. L'espace organisateur intégré permet de
gérer les sorties, scanner les QR codes et suivre les paiements sur place.

Réalisation du MVP décrit dans *Spécifications V1 — document de cadrage (11 novembre 2026)*.

| Dossier | Contenu |
|---|---|
| [`mobile/`](mobile) | Application React Native + Expo (SDK 54, compatible Expo Go) + TypeScript, navigation Expo Router |
| [`supabase/migrations/`](supabase/migrations) | Schéma PostgreSQL, règles métier (fonctions serveur), RLS et droits |
| [`supabase/functions/`](supabase/functions) | Edge Function d'envoi des e-mails et notifications push |
| [`supabase/tests/`](supabase/tests) | Tests des règles métier et de concurrence (§11) |

## Ce qui est en place

**Application publique** : accueil, liste des sorties à venir (places restantes, statut), fiche détaillée
(rendez-vous, équipement, consignes, itinéraire), réservation sans compte (contact principal, nombre de
participants, noms des accompagnants facultatifs, consentements), confirmation avec un QR code par
participant, espace « Mes réservations » (historique, annulation dans le délai), activation des rappels
push après la réservation, galerie des sorties passées, page conditions et confidentialité.

**Administration** (accès protégé, comptes créés par l'organisateur) : tableau de bord par sortie
(places, présents, paiements, montants), création et modification des sorties avec photo, liste des
participants avec recherche et filtres, pointage manuel de secours, liste partageable hors réseau,
scanner QR (valide / déjà présent / annulé / autre sortie / inconnu), paiement sur place (espèces, carte,
virement, autre ; payé, partiel, non réglé), annulation d'une réservation ou d'une sortie, paramètres
(contact, capacité par défaut, délai d'annulation, rappels, durée de conservation).

**Serveur** — les règles sensibles ne vivent pas dans l'application :

- Réservation **atomique** : la capacité est vérifiée et décomptée en une seule mise à jour conditionnelle
  verrouillant la sortie ; jamais de dépassement ni de réservation partielle.
- **Clé d'idempotence** par formulaire : un double appui ou une requête rejouée renvoie la même réservation.
- Une annulation libère les places **une seule fois** et invalide les QR codes.
- **QR codes opaques** : `RPL1.` + jeton HMAC imprévisible, un par participant ; seule l'empreinte SHA-256
  est stockée. Aucun nom ni e-mail dans le QR code.
- Pointage atomique (« déjà présent » signalé, jamais de second pointage silencieux), journal d'audit des
  pointages, paiements et modifications de sorties.
- **RLS** sur toutes les tables, droits minimaux (`anon` ne lit que les sorties publiées), aucun rôle
  administrateur attribuable depuis l'application, colonnes sensibles (`seats_taken`) non modifiables.
- **File de notifications transactionnelle** : l'e-mail n'est créé qu'une fois la réservation validée,
  puis envoyé par l'Edge Function (QR codes joints en images) ; le push est un canal complémentaire.
- Rappels configurables (par défaut J-1 et 3 h avant), anonymisation automatique après la durée de
  conservation, effacement à la demande.

## Arbitrages appliqués par défaut (§13)

Les « propositions par défaut » du document ont été retenues ; elles restent à confirmer et sont faciles à changer.

| Sujet | Choix implémenté | Où le changer |
|---|---|---|
| Compte participant | Pas de compte. Les réservations sont conservées sur l'appareil ; le lien « Ouvrir ma réservation » de l'e-mail les retrouve ailleurs. | — |
| Réservation de groupe | Un contact principal, un QR code par participant ; noms des accompagnants facultatifs. | `create_reservation` |
| Annulation | Jusqu'à 24 h avant le départ (réglable globalement et par sortie). | Paramètres admin |
| Capacité | 30 par défaut, modifiable par sortie, jamais en dessous des places déjà prises. | Paramètres admin |
| Tarifs | Tarif par personne, total calculé et figé à la réservation. | Fiche sortie |
| Doublons | Une seule réservation active par e-mail et par sortie. | `create_reservation` |
| Max. par réservation | 10 participants. | Paramètres admin |
| Paiements | Espèces, carte, virement, autre. | `payment_method` |
| Rappels | Push J-1 et H-3 ; le rappel J-1 part aussi par e-mail. | Paramètres admin |
| Conservation | Anonymisation 24 mois après la dernière sortie. | Paramètres admin |
| Liste d'attente | Hors MVP (la sortie complète affiche un message clair). | — |

Encore ouvert : l'adresse e-mail officielle d'envoi et le fournisseur d'e-mails (Resend est branché ;
les autres sont faciles à ajouter dans `process-notifications`).

## Mise en route

### 1. Supabase

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push                     # applique supabase/migrations
```

- **Administrateur** : créer l'utilisateur dans *Authentication › Users*, puis dans l'éditeur SQL :
  `select private.grant_admin('orga@exemple.fr', 'Prénom', 'Nom');`
  Prévoir au moins deux comptes administrateur (secours).
- **Inscriptions publiques désactivées** (*Authentication › Providers › Email › Allow new users to sign up* : off).
- **Mot de passe oublié** : l'application saisit un code ; le modèle d'e-mail *Reset password* doit
  contenir `{{ .Token }}`.
- **Edge Function** :

```bash
supabase secrets set NOTIFICATIONS_CRON_SECRET=<aléatoire> RESEND_API_KEY=<clé> EMAIL_FROM="Rando Pleine Lune <reservations@domaine.fr>"
```

```bash
supabase functions deploy process-notifications
```

- **Planification** : activer `pg_cron` et `pg_net`, puis exécuter [`supabase/cron.sql`](supabase/cron.sql)
  (envoi toutes les 2 min, anonymisation nocturne).

### 2. Application

```bash
cd mobile && npm install && cp .env.example .env   # renseigner l'URL et la clé anon
```

```bash
npx expo start
```

Les notifications push et le scanner nécessitent un **development build** (`npx eas-cli build --profile development`)
et un `extra.eas.projectId` dans `app.json` (créé par `eas init`). Identifiant d'application provisoire :
`fr.randopleinelune.app` (à confirmer avant publication).

## Tests

```bash
PGHOST=localhost PGUSER=postgres ./supabase/tests/run.sh   # 67 règles + 3 scénarios de concurrence
```

```bash
cd mobile && npm test && npm run typecheck && npm run lint
```

```bash
node --experimental-strip-types --test supabase/functions/_shared/templates.test.ts
```

`run.sh` recrée une base `rpl_test` sur un PostgreSQL ≥ 15 et simule les rôles Supabase. Il couvre le plan
de tests §11 : capacité exacte et dépassée, 40 réservations simultanées pour 30 places, dernière place
disputée, double clic, annulation unique, QR valide / déjà pointé / annulé / inconnu / autre sortie, accès
admin refusé, push refusée, paiement tracé. **Les tests de capacité et de concurrence sont bloquants avant
l'ouverture au public.**

## Reste à faire avant publication

- **Lot 1 — identité visuelle** : icône, écran de démarrage, photos réelles (les écrans utilisent les
  emplacements des maquettes), relecture des textes.
- **Tests sur appareils réels** iOS et Android (scanner, notifications, lien profond depuis l'e-mail) :
  l'application a été vérifiée par typage, lint, tests unitaires, compilation des bundles iOS/Android et
  rendu web des écrans, pas encore sur téléphone.
- **Edge Function** : à exécuter une première fois en préproduction (seuls ses gabarits sont testés ici).
- **MFA administrateur** (TOTP Supabase) : recommandé par le §9, pas encore implémenté.
- **RGPD et stores** : compléter et faire valider la page confidentialité (responsable de traitement,
  hébergement, sous-traitants), fiches stores, captures, déclarations de données (Lot 8).
- Environnements séparés développement / préproduction / production avec clés distinctes.
