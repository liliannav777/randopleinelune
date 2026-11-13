// Photos du Beaujolais intégrées à l'application (sous licence libre, voir PHOTO_CREDITS).
// Servent d'illustration tant que l'organisateur n'a pas ajouté ses propres photos.
import type { ImageSourcePropType } from 'react-native';
import { PHOTOS } from './photos.data';

export type Photo = {
  id: string;
  source: ImageSourcePropType;
  /** Légende affichée (lieu). */
  caption: string;
  author: string;
  license: string;
  licenseUrl: string;
  /** Page de la photo sur Wikimedia Commons. */
  sourceUrl: string;
};

export { PHOTOS };

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Lieux reconnus dans le titre ou le point de rendez-vous d'une sortie.
const PLACES: { words: string[]; ids: string[] }[] = [
  { words: ['brouilly', 'odenas', 'saint-lager', 'saint lager'], ids: ['brouilly', 'brouilly-automne', 'cercie'] },
  { words: ['cercie'], ids: ['cercie'] },
  { words: ['oingt', 'pierres dorees'], ids: ['oingt'] },
  { words: ['fleurie', 'madone'], ids: ['fleurie'] },
  { words: ['julienas'], ids: ['julienas'] },
  { words: ['vaux'], ids: ['vaux'] },
];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Photo attribuée de façon stable à une sortie (même sortie = même photo).
 * Si le titre ou le lieu mentionne un endroit photographié, cette photo est choisie.
 * La photo d'accueil est exclue pour éviter les doublons avec l'écran d'accueil.
 */
export function photoFor(seed: string, hint?: string): Photo | undefined {
  const pool = PHOTOS.filter((p) => p.id !== 'hero');
  if (pool.length === 0) return PHOTOS[0];
  if (hint) {
    const text = normalize(hint);
    const place = PLACES.find((pl) => pl.words.some((w) => text.includes(w)));
    const matches = place ? pool.filter((p) => place.ids.includes(p.id)) : [];
    if (matches.length) return matches[hash(seed) % matches.length];
  }
  return pool[hash(seed) % pool.length];
}

/** Photo d'accueil. */
export function heroPhoto(): Photo | undefined {
  return PHOTOS.find((p) => p.id === 'hero') ?? PHOTOS[0];
}
