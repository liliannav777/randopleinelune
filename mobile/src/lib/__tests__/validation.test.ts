import { attendeesPayload, validateReservation, type ReservationForm } from '../validation';

const base: ReservationForm = {
  firstName: 'Camille', lastName: 'Martin', email: 'camille@example.org', phone: '06 12 34 56 78',
  participantCount: 2, companions: [], acceptTerms: true, acceptPrivacy: true,
};
const opts = { maxPerReservation: 10, seatsLeft: 12 };

describe('validateReservation', () => {
  it('accepte un formulaire complet', () => {
    expect(validateReservation(base, opts)).toEqual({});
  });
  it('exige les consentements', () => {
    expect(validateReservation({ ...base, acceptPrivacy: false }, opts).consent).toBeDefined();
  });
  it('refuse un e-mail ou un téléphone invalide', () => {
    const e = validateReservation({ ...base, email: 'camille@', phone: 'abc' }, opts);
    expect(e.email).toBeDefined();
    expect(e.phone).toBeDefined();
  });
  it('limite au nombre de places restantes', () => {
    expect(validateReservation({ ...base, participantCount: 3 }, { maxPerReservation: 10, seatsLeft: 2 }).participantCount)
      .toBe('Il reste 2 places.');
    expect(validateReservation(base, { maxPerReservation: 10, seatsLeft: 0 }).participantCount)
      .toBe('Cette sortie est complète.');
  });
  it('limite par réservation', () => {
    expect(validateReservation({ ...base, participantCount: 11 }, { maxPerReservation: 10, seatsLeft: 30 }).participantCount)
      .toBe('10 participants maximum par réservation.');
  });
});

describe('attendeesPayload', () => {
  it('vide si aucun nom d’accompagnant (le serveur nomme les accompagnants)', () => {
    expect(attendeesPayload(base)).toEqual([]);
  });
  it('un nom par participant, contact en premier', () => {
    const p = attendeesPayload({ ...base, participantCount: 3, companions: [{ firstName: 'Léo', lastName: 'Martin' }] });
    expect(p).toEqual([
      { first_name: 'Camille', last_name: 'Martin' },
      { first_name: 'Léo', last_name: 'Martin' },
      { first_name: '', last_name: '' },
    ]);
  });
  it('ignore les accompagnants au-delà du nombre de participants', () => {
    const p = attendeesPayload({ ...base, participantCount: 2, companions: [{ firstName: 'A', lastName: 'B' }, { firstName: 'C', lastName: 'D' }] });
    expect(p).toHaveLength(2);
  });
});
