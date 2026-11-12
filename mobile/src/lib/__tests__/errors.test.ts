import { toAppError } from '../errors';

describe('toAppError', () => {
  it('traduit une sortie complète avec places restantes', () => {
    const e = toAppError({ message: 'EVENT_FULL', details: '2', code: 'P0001' });
    expect(e.code).toBe('EVENT_FULL');
    expect(e.message).toBe('Il ne reste que 2 places pour cette sortie. Réduisez le nombre de participants.');
  });
  it('sortie complète sans place', () => {
    expect(toAppError({ message: 'EVENT_FULL', details: '0' }).message).toMatch(/complète/);
  });
  it('champ invalide précis', () => {
    expect(toAppError({ message: 'INVALID_INPUT', details: 'email' }).message).toBe("L'adresse e-mail n'est pas valide.");
  });
  it('capacité sous les réservations', () => {
    expect(toAppError({ code: '23514', message: 'violates check constraint "events_seats_within_capacity"' }).code)
      .toBe('CAPACITY_BELOW_BOOKED');
  });
  it('erreur réseau', () => {
    expect(toAppError(new TypeError('Network request failed')).code).toBe('NETWORK');
  });
  it('erreur inconnue', () => {
    expect(toAppError({ message: 'boom' }).code).toBe('UNKNOWN');
  });
});
