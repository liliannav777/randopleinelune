import { centsToInput, formatPrice, formatTariff, parseEuros, parseParisDateTime, seatsLeftLabel, toParisInputs } from '../format';

describe('prix', () => {
  it('formate en euros', () => {
    expect(formatPrice(2000)).toMatch(/^20,00\s€$/);
    expect(formatPrice(0)).toMatch(/^0,00\s€$/);
    expect(formatTariff(0)).toBe('Gratuit');
    expect(formatTariff(2000)).toMatch(/^20,00\s€ \/ personne$/);
  });
  it('lit une saisie en euros', () => {
    expect(parseEuros('20')).toBe(2000);
    expect(parseEuros('12,5')).toBe(1250);
    expect(parseEuros('12.50 €')).toBe(1250);
    expect(parseEuros('douze')).toBeNull();
    expect(parseEuros('-3')).toBeNull();
  });
  it('aller-retour', () => {
    expect(centsToInput(2000)).toBe('20');
    expect(centsToInput(1250)).toBe('12,50');
  });
});

describe('places', () => {
  it('affiche les places restantes ou complet', () => {
    expect(seatsLeftLabel(30, 18)).toBe('Places disponibles : 12 / 30');
    expect(seatsLeftLabel(30, 30)).toBe('Complet');
  });
});

describe('dates à l’heure de Paris', () => {
  it('hiver (UTC+1)', () => {
    expect(parseParisDateTime('28/11/2026', '19:00')).toBe('2026-11-28T18:00:00.000Z');
  });
  it('été (UTC+2)', () => {
    expect(parseParisDateTime('15/07/2026', '21:30')).toBe('2026-07-15T19:30:00.000Z');
  });
  it('refuse une date inexistante', () => {
    expect(parseParisDateTime('31/02/2026', '19:00')).toBeNull();
    expect(parseParisDateTime('2026-11-28', '19:00')).toBeNull();
    expect(parseParisDateTime('28/11/2026', '25:00')).toBeNull();
  });
  it('aller-retour saisie', () => {
    expect(toParisInputs('2026-11-28T18:00:00.000Z')).toEqual({ date: '28/11/2026', time: '19:00' });
  });
});
