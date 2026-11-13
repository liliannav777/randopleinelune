import { heroPhoto, photoFor, PHOTOS } from '../photos';

describe('photos du Beaujolais', () => {
  it('chaque photo a ses crédits complets', () => {
    expect(PHOTOS.length).toBeGreaterThan(0);
    for (const p of PHOTOS) {
      expect(p.author).toBeTruthy();
      expect(p.license).toMatch(/^CC (BY|BY-SA|0)/);
      expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });
  it('photo stable par sortie et jamais celle de l’accueil', () => {
    expect(photoFor('abc')).toBe(photoFor('abc'));
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) expect(photoFor(seed)?.id).not.toBe(heroPhoto()?.id);
  });
  it('choisit la photo du lieu mentionné', () => {
    expect(['brouilly', 'brouilly-automne', 'cercie']).toContain(photoFor('x', 'Pleine lune au Mont Brouilly')?.id);
    expect(photoFor('y', "Parking de l'église, Oingt")?.id).toBe('oingt');
    expect(photoFor('z', 'Balade à Juliénas')?.id).toBe('julienas');
  });
});
