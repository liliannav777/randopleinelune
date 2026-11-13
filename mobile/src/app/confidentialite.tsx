import { useRouter } from 'expo-router';
import { Linking, Pressable, Text } from 'react-native';
import { Body, Header, Screen, SectionTitle } from '@/components/ui';
import { getSettings } from '@/lib/api';
import { PHOTOS } from '@/lib/photos';
import { useFocusData } from '@/lib/useAsync';

// Texte de travail à faire valider avant la mise en production
// (Spécifications V1 §7 « Protection des données » et §10).
export default function Privacy() {
  const router = useRouter();
  const { data: settings } = useFocusData(getSettings);
  const org = settings?.organizer_name ?? 'Rando Pleine Lune Lyon Beaujolais';
  const contact = [settings?.organizer_email, settings?.organizer_phone].filter(Boolean).join(' · ');
  const retention = settings?.data_retention_months ?? 24;

  return (
    <Screen header={<Header title="Confidentialité" subtitle="Conditions et données personnelles" onBack={() => router.back()} />}>
      <SectionTitle>Conditions de participation</SectionTitle>
      <Body>
        La réservation est obligatoire pour participer. Le tarif est réglé sur place le jour de la sortie. Chaque
        participant présente son QR code à l’arrivée. Les participants suivent les consignes de l’organisateur et
        s’équipent selon les recommandations de la fiche randonnée (frontale, chaussures adaptées, vêtements chauds).
        L’organisateur peut annuler ou modifier une sortie (météo, sécurité) ; les inscrits sont alors prévenus.
      </Body>

      <SectionTitle>Données collectées</SectionTitle>
      <Body>
        Pour organiser les sorties, nous collectons uniquement : nom et prénom du contact et des participants,
        adresse e-mail, téléphone, nombre de participants, présence et statut du paiement sur place. Si vous activez
        les notifications, un identifiant technique de l’appareil est enregistré pour vous envoyer les rappels.
      </Body>

      <SectionTitle>Finalités</SectionTitle>
      <Body>
        Gestion des inscriptions et de la capacité, envoi de la confirmation et des rappels, contrôle des arrivées,
        suivi des paiements sur place et information en cas de modification ou d’annulation. Aucune publicité n’est
        envoyée et vos données ne sont ni vendues ni cédées.
      </Body>

      <SectionTitle>Durée de conservation</SectionTitle>
      <Body>
        Les données sont anonymisées automatiquement {retention} mois après votre dernière sortie.
      </Body>

      <SectionTitle>Vos droits</SectionTitle>
      <Body>
        Vous pouvez demander l’accès, la rectification ou la suppression de vos données en contactant {org}
        {contact ? ` (${contact})` : ''}. Vous pouvez aussi introduire une réclamation auprès de la CNIL.
      </Body>

      {PHOTOS.length > 0 ? (
        <>
          <SectionTitle>Crédits photos</SectionTitle>
          <Body muted style={{ fontSize: 13, lineHeight: 19 }}>
            Photos du Beaujolais issues de Wikimedia Commons, utilisées selon leur licence libre (Creative
            Commons). Elles ont été recadrées, redimensionnées et parfois assombries pour l’application.
            Touchez une photo pour voir sa source, ou la licence pour en lire les conditions.
          </Body>
          {PHOTOS.map((p) => (
            <Pressable key={p.id} onPress={() => Linking.openURL(p.sourceUrl)} accessibilityRole="link">
              <Body style={{ fontSize: 13, lineHeight: 19 }}>
                « {p.caption} » — {p.author},{' '}
                <Text style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL(p.licenseUrl)}>{p.license}</Text>
              </Body>
            </Pressable>
          ))}
        </>
      ) : null}

      <SectionTitle>Hébergement</SectionTitle>
      <Body muted>
        Données hébergées chez notre prestataire technique (Supabase) ; e-mails envoyés par un prestataire
        d’envoi transactionnel. Informations à compléter avant publication (responsable de traitement, région
        d’hébergement, sous-traitants).
      </Body>
    </Screen>
  );
}
