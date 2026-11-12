import type { Difficulty, PaymentStatus } from './types';

const TZ = 'Europe/Paris';

/** Montant en euros (0 => « 0,00 € »). Pour un tarif, voir formatTariff. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Tarif d'une sortie par personne. */
export function formatTariff(cents: number): string {
  return cents === 0 ? 'Gratuit' : `${formatPrice(cents)} / personne`;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'long' }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} à ${formatTime(iso)}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDistance(km: number | null): string | null {
  if (km == null) return null;
  return `${String(km).replace('.', ',')} km`;
}

export const difficultyLabel: Record<Difficulty, string> = {
  facile: 'Facile',
  moyenne: 'Moyenne',
  soutenue: 'Soutenue',
  difficile: 'Difficile',
};

export const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: 'Non réglé',
  partial: 'Partiellement réglé',
  paid: 'Payé',
};

export function seatsLeftLabel(capacity: number, taken: number): string {
  const left = Math.max(0, capacity - taken);
  if (left === 0) return 'Complet';
  return `Places disponibles : ${left} / ${capacity}`;
}

/** "20" / "20,50" / "20.5" -> centimes ; null si invalide. */
export function parseEuros(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');
}

/**
 * Saisie « JJ/MM/AAAA » + « HH:MM » interprétée à l'heure de Paris.
 * Retourne une date ISO (UTC) ou null si invalide.
 */
export function parseParisDateTime(date: string, time: string): string | null {
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date.trim());
  const t = /^(\d{1,2})[:h](\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [day, month, year, hour, minute] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  // Décalage de Paris à cette date (gère l'heure d'été).
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMin = parisOffsetMinutes(new Date(guess));
  const utc = new Date(guess - offsetMin * 60_000);
  // Vérifie que la date existe (ex. 31/02) : relecture en heure de Paris.
  const back = parisParts(utc);
  if (back.day !== day || back.month !== month || back.year !== year) return null;
  return utc.toISOString();
}

function parisParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

function parisOffsetMinutes(d: Date): number {
  const p = parisParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(d.getTime() / 60_000) * 60_000) / 60_000);
}

/** Date ISO -> { date: "JJ/MM/AAAA", time: "HH:MM" } à l'heure de Paris. */
export function toParisInputs(iso: string): { date: string; time: string } {
  const p = parisParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${pad(p.day)}/${pad(p.month)}/${p.year}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}
