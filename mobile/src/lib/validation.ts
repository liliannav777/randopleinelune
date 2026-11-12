// Validation côté application (confort de saisie). Les mêmes règles sont
// appliquées côté serveur dans create_reservation : le serveur fait foi.

export type ReservationForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  participantCount: number;
  /** Noms des accompagnants (positions 2..n), facultatifs. */
  companions: { firstName: string; lastName: string }[];
  acceptTerms: boolean;
  acceptPrivacy: boolean;
};

export type FormErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'phone' | 'participantCount' | 'consent', string>>;

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/;

export function validateReservation(f: ReservationForm, opts: { maxPerReservation: number; seatsLeft: number }): FormErrors {
  const errors: FormErrors = {};
  if (!f.firstName.trim() || f.firstName.trim().length > 80) errors.firstName = 'Indiquez votre prénom.';
  if (!f.lastName.trim() || f.lastName.trim().length > 80) errors.lastName = 'Indiquez votre nom.';
  if (!EMAIL_RE.test(f.email.trim())) errors.email = 'Adresse e-mail invalide.';
  if (!PHONE_RE.test(f.phone.trim())) errors.phone = 'Numéro de téléphone invalide.';
  if (!Number.isInteger(f.participantCount) || f.participantCount < 1) {
    errors.participantCount = 'Au moins un participant.';
  } else if (f.participantCount > opts.maxPerReservation) {
    errors.participantCount = `${opts.maxPerReservation} participants maximum par réservation.`;
  } else if (f.participantCount > opts.seatsLeft) {
    errors.participantCount = opts.seatsLeft === 0
      ? 'Cette sortie est complète.'
      : `Il reste ${opts.seatsLeft} place${opts.seatsLeft > 1 ? 's' : ''}.`;
  }
  if (!f.acceptTerms || !f.acceptPrivacy) errors.consent = 'Merci d\'accepter les conditions et la politique de confidentialité.';
  return errors;
}

/** Construit la liste des participants envoyée au serveur (vide si aucun nom saisi). */
export function attendeesPayload(f: ReservationForm): { first_name: string; last_name: string }[] {
  const companions = f.companions.slice(0, Math.max(0, f.participantCount - 1));
  if (companions.every((c) => !c.firstName.trim() && !c.lastName.trim())) return [];
  return [
    { first_name: f.firstName.trim(), last_name: f.lastName.trim() },
    ...Array.from({ length: f.participantCount - 1 }, (_, i) => ({
      first_name: companions[i]?.firstName.trim() ?? '',
      last_name: companions[i]?.lastName.trim() ?? '',
    })),
  ];
}
