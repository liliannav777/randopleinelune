// Direction artistique (Spécifications V1 §4).
export const colors = {
  primary: '#14243A', // Bleu nuit
  secondary: '#203651', // Bleu ardoise
  accent: '#D8B66A', // Doré lunaire
  background: '#F3F5F8', // Blanc cassé / gris très clair
  text: '#202936', // Bleu très sombre
  textMuted: '#5B6575',
  surface: '#FFFFFF',
  placeholder: '#DCE3EB',
  border: '#D5DCE4',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#CFD6E0',
  success: '#1E7A4F',
  successBg: '#E3F3EA',
  warning: '#8A5A00',
  warningBg: '#FBF0D9',
  danger: '#B3261E',
  dangerBg: '#FBE4E2',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const font = {
  title: 22,
  heading: 18,
  body: 16,
  small: 14,
  tiny: 12,
} as const;

// Zone tactile minimale recommandée (accessibilité).
export const MIN_TOUCH = 48;
