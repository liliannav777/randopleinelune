// Traduction des codes d'erreur métier renvoyés par les fonctions serveur
// (private.raise_business_error) en messages clairs pour l'utilisateur.

export type BusinessErrorCode =
  | 'EVENT_FULL'
  | 'EVENT_NOT_FOUND'
  | 'EVENT_NOT_OPEN'
  | 'ALREADY_BOOKED'
  | 'CONSENT_REQUIRED'
  | 'INVALID_INPUT'
  | 'TOO_MANY_REQUESTS'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RESERVATION_NOT_FOUND'
  | 'CANCELLATION_CLOSED'
  | 'FORBIDDEN';

export class AppError extends Error {
  constructor(
    public code: BusinessErrorCode | 'NETWORK' | 'UNKNOWN' | 'CAPACITY_BELOW_BOOKED',
    message: string,
    public detail?: string,
  ) {
    super(message);
  }
}

const INPUT_FIELDS: Record<string, string> = {
  name: 'Indiquez votre prénom et votre nom.',
  email: "L'adresse e-mail n'est pas valide.",
  phone: "Le numéro de téléphone n'est pas valide.",
  participant_count: "Le nombre de participants n'est pas valide.",
  attendees: 'Les noms des participants ne sont pas valides.',
  amount: "Le montant n'est pas valide.",
  push_token: "L'appareil n'a pas pu être enregistré pour les notifications.",
};

export function messageFor(code: string, detail?: string): string {
  switch (code) {
    case 'EVENT_FULL': {
      const left = Number(detail);
      if (Number.isFinite(left) && left > 0) {
        return `Il ne reste que ${left} place${left > 1 ? 's' : ''} pour cette sortie. Réduisez le nombre de participants.`;
      }
      return 'Cette sortie est complète. Aucune réservation n\'a été enregistrée.';
    }
    case 'EVENT_NOT_FOUND':
      return "Cette sortie n'existe pas ou n'est plus disponible.";
    case 'EVENT_NOT_OPEN':
      return 'Les inscriptions pour cette sortie sont fermées.';
    case 'ALREADY_BOOKED':
      return 'Une réservation existe déjà pour cette sortie avec cette adresse e-mail. Retrouvez-la dans « Mes réservations ».';
    case 'CONSENT_REQUIRED':
      return 'Merci d\'accepter les conditions et la politique de confidentialité.';
    case 'INVALID_INPUT':
      return (detail && INPUT_FIELDS[detail]) || 'Certaines informations ne sont pas valides.';
    case 'TOO_MANY_REQUESTS':
      return 'Trop de tentatives. Merci de patienter quelques minutes.';
    case 'IDEMPOTENCY_CONFLICT':
      return 'Une erreur est survenue. Merci de recommencer la réservation.';
    case 'RESERVATION_NOT_FOUND':
      return 'Réservation introuvable. Le lien est peut-être incomplet.';
    case 'CANCELLATION_CLOSED':
      return "Le délai d'annulation est dépassé. Contactez l'organisateur.";
    case 'FORBIDDEN':
      return 'Accès réservé aux administrateurs.';
    case 'CAPACITY_BELOW_BOOKED':
      return 'La capacité ne peut pas être inférieure au nombre de places déjà réservées.';
    case 'NETWORK':
      return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
    default:
      return 'Une erreur inattendue est survenue. Réessayez dans un instant.';
  }
}

type PgError = { message?: string; details?: string | null; code?: string };

const KNOWN = new Set<string>([
  'EVENT_FULL', 'EVENT_NOT_FOUND', 'EVENT_NOT_OPEN', 'ALREADY_BOOKED', 'CONSENT_REQUIRED', 'INVALID_INPUT',
  'TOO_MANY_REQUESTS', 'IDEMPOTENCY_CONFLICT', 'RESERVATION_NOT_FOUND', 'CANCELLATION_CLOSED', 'FORBIDDEN',
]);

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const e = (err ?? {}) as PgError;
  const msg = e.message ?? '';
  if (KNOWN.has(msg)) {
    const detail = e.details ?? undefined;
    return new AppError(msg as BusinessErrorCode, messageFor(msg, detail), detail);
  }
  if (e.code === '23514' && msg.includes('events_seats_within_capacity')) {
    return new AppError('CAPACITY_BELOW_BOOKED', messageFor('CAPACITY_BELOW_BOOKED'));
  }
  if (e.code === '42501') {
    return new AppError('FORBIDDEN', messageFor('FORBIDDEN'));
  }
  if (/network|fetch|timeout/i.test(msg)) {
    return new AppError('NETWORK', messageFor('NETWORK'));
  }
  return new AppError('UNKNOWN', messageFor('UNKNOWN'), msg);
}
