// Direction artistique (Spécifications V1 §4) : bleu nuit, bleu ardoise, doré lunaire.
// Univers « nuit étoilée » : ciel dégradé, lune lumineuse, collines du Beaujolais.
import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  night: '#0B1626', // ciel profond (dégradés)
  primary: '#14243A', // Bleu nuit
  secondary: '#203651', // Bleu ardoise
  slate: '#2C4766',
  accent: '#D8B66A', // Doré lunaire
  accentLight: '#EBD49C',
  accentSoft: '#F6EDD8',
  accentDark: '#7A5E22',
  background: '#F3F5F8', // Blanc cassé / gris très clair
  text: '#202936', // Bleu très sombre
  textMuted: '#5B6575',
  textFaint: '#8A93A3',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FB',
  placeholder: '#DCE3EB',
  border: '#E3E8EF',
  borderStrong: '#C9D2DD',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#B9C4D3',
  success: '#1E7A4F',
  successBg: '#E3F3EA',
  warning: '#8A5A00',
  warningBg: '#FBF0D9',
  danger: '#B3261E',
  dangerBg: '#FBE4E2',
} as const;

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

export function shadow(level: 1 | 2 | 3 = 1): ViewStyle {
  const s = { 1: [2, 8, 0.06], 2: [6, 16, 0.09], 3: [12, 28, 0.16] }[level];
  return Platform.select<ViewStyle>({
    ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: s[0] }, shadowRadius: s[1], shadowOpacity: s[2] },
    android: { elevation: level * 2 },
    default: { boxShadow: `0px ${s[0]}px ${s[1]}px rgba(20,36,58,${s[2]})` } as ViewStyle,
  })!;
}
