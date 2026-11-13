// Direction artistique (Spécifications V1 §4) : bleu nuit, bleu ardoise, doré lunaire.
// Deux palettes (claire / sombre) avec les mêmes noms de jetons ; les composants
// lisent la palette active via useColors() / useStyles() (src/lib/theme.tsx).
import { Platform, type ViewStyle } from 'react-native';

/** Couleurs de marque, identiques dans les deux thèmes (ciel, lune, en-têtes). */
export const brand = {
  night: '#0B1626',
  primary: '#14243A', // Bleu nuit
  slate: '#2C4766',
  accent: '#D8B66A', // Doré lunaire
  accentLight: '#EBD49C',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#B9C4D3',
  white: '#FFFFFF',
} as const;

export const lightColors = {
  ...brand,
  /** Fond des boutons principaux. */
  secondary: '#203651', // Bleu ardoise
  /** Liens, icônes d'action, texte des boutons secondaires. */
  link: '#203651',
  accentSoft: '#F6EDD8',
  accentDark: '#7A5E22',
  background: '#F3F5F8', // Blanc cassé / gris très clair
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FB',
  chip: '#EEF2F7',
  track: '#E6EBF1',
  placeholder: '#DCE3EB',
  border: '#E3E8EF',
  borderStrong: '#C9D2DD',
  text: '#202936', // Bleu très sombre
  textMuted: '#5B6575',
  textFaint: '#8A93A3',
  tabActive: '#14243A',
  success: '#1E7A4F',
  successBg: '#E3F3EA',
  warning: '#8A5A00',
  warningBg: '#FBF0D9',
  danger: '#B3261E',
  dangerBg: '#FBE4E2',
  neutralBg: '#E8EDF3',
  neutralFg: '#203651',
  shadow: '#14243A',
};

export type Colors = typeof lightColors;

export const darkColors: Colors = {
  ...brand,
  secondary: '#2F4C72',
  link: '#A9C3E4',
  accentSoft: '#33291A',
  accentDark: '#E5CB8C',
  background: '#09111C',
  surface: '#121D2C',
  surfaceAlt: '#172536',
  chip: '#1B2A3D',
  track: '#22324A',
  placeholder: '#1E2D40',
  border: '#22324A',
  borderStrong: '#34485F',
  text: '#E8EDF3',
  textMuted: '#A8B3C2',
  textFaint: '#7C899B',
  tabActive: '#EBD49C',
  success: '#74D3A3',
  successBg: '#15322A',
  warning: '#F0C66E',
  warningBg: '#382B12',
  danger: '#FF8F86',
  dangerBg: '#3A1B1D',
  neutralBg: '#1F2E42',
  neutralFg: '#C3D2E6',
  shadow: '#000000',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Familles chargées dans app/_layout.tsx (Fraunces pour les titres, Inter pour le texte). */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  displayItalic: 'Fraunces_400Regular_Italic',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const font = {
  hero: 34,
  title: 26,
  heading: 20,
  body: 16,
  small: 14,
  tiny: 12,
} as const;

// Zone tactile minimale recommandée (accessibilité).
export const MIN_TOUCH = 48;

export function shadow(level: 1 | 2 | 3 = 1, color: string = lightColors.shadow): ViewStyle {
  const s = { 1: [2, 8, 0.06], 2: [6, 16, 0.09], 3: [12, 28, 0.16] }[level];
  const opacity = color === lightColors.shadow ? s[2] : s[2] * 3;
  return Platform.select<ViewStyle>({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: s[0] }, shadowRadius: s[1], shadowOpacity: opacity },
    android: { elevation: level * 2 },
    default: { boxShadow: `0px ${s[0]}px ${s[1]}px rgba(${color === lightColors.shadow ? '20,36,58' : '0,0,0'},${opacity})` } as ViewStyle,
  })!;
}
