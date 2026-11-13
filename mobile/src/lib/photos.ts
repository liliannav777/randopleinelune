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

/** Photo attribuée de façon stable à une sortie (même sortie = même photo). */
export function photoFor(seed: string): Photo | undefined {
  if (PHOTOS.length === 0) return undefined;
  return PHOTOS[hash(seed) % PHOTOS.length];
}

/** Photo d'accueil. */
export function heroPhoto(): Photo | undefined {
  return PHOTOS.find((p) => p.id === 'hero') ?? PHOTOS[0];
}
