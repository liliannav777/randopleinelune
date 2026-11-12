// Composants d'interface partagés, fidèles aux maquettes (Spécifications V1 §4).
import { type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle, type StyleProp, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, MIN_TOUCH, radius, spacing } from '@/theme';

// ---------------------------------------------------------------------------
// En-tête bleu nuit avec la lune dorée
// ---------------------------------------------------------------------------
export function Header({ title, subtitle, onBack, right }: {
  title: string; subtitle?: string; onBack?: () => void; right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour" hitSlop={12}
            style={styles.headerSide}>
            <Text style={styles.headerBack}>‹</Text>
          </Pressable>
        ) : <View style={styles.headerSide} />}
        <View style={styles.moon} accessibilityElementsHidden importantForAccessibility="no" />
        <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
      </View>
      <Text style={styles.headerTitle} accessibilityRole="header">{title.toUpperCase()}</Text>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Écran défilant standard
// ---------------------------------------------------------------------------
export function Screen({ header, children, refreshing, onRefresh, footer }: {
  header: ReactNode; children: ReactNode; refreshing?: boolean; onRefresh?: () => void; footer?: ReactNode;
}) {
  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {children}
      </ScrollView>
      {footer ? <SafeAreaView edges={['bottom']} style={styles.footer}>{footer}</SafeAreaView> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------------------
export function Button({ title, onPress, variant = 'primary', disabled, loading, accessibilityHint, style }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean; loading?: boolean; accessibilityHint?: string; style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'ghost' && styles.buttonGhost,
        inactive && styles.buttonDisabled,
        pressed && !inactive && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.secondary : colors.onPrimary} />
        : (
          <Text style={[
            styles.buttonText,
            (variant === 'secondary' || variant === 'ghost') && { color: colors.secondary },
          ]}>{title}</Text>
        )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Blocs de contenu
// ---------------------------------------------------------------------------
export function Card({ children, style, onPress, accessibilityLabel }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title} accessibilityRole="header">{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle} accessibilityRole="header">{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[styles.body, muted && { color: colors.textMuted }, style]}>{children}</Text>;
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function Placeholder({ label, height = 140 }: { label: string; height?: number }) {
  return (
    <View style={[styles.placeholder, { height }]}>
      <Text style={styles.placeholderText}>{label}</Text>
    </View>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
const toneStyle: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.placeholder, fg: colors.text },
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  accent: { bg: '#F6EDD8', fg: '#6B5420' },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = toneStyle[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function Banner({ message, tone = 'danger' }: { message: string; tone?: Tone }) {
  const t = toneStyle[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={{ color: t.fg, fontSize: font.small }}>{message}</Text>
    </View>
  );
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator size="large" color={colors.secondary} /></View>;
}

export function Empty({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {message ? <Body muted style={{ textAlign: 'center' }}>{message}</Body> : null}
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Formulaires
// ---------------------------------------------------------------------------
export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, error && { borderColor: colors.danger }, props.style]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }}
      style={styles.checkboxRow} hitSlop={6}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>✓</Text> : null}
      </View>
      <Text style={[styles.body, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ value, min, max, onChange, label }: {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - 1));
        }}>
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          accessibilityLabel="Retirer un participant">
          <Text style={[styles.stepTxt, value <= min && { opacity: 0.3 }]}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          accessibilityLabel="Ajouter un participant">
          <Text style={[styles.stepTxt, value >= max && { opacity: 0.3 }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && { backgroundColor: colors.secondary, borderColor: colors.secondary }]}>
            <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: font.small }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  footer: { padding: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.background, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  header: {
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, alignItems: 'center',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-between' },
  headerSide: { width: 72, minHeight: 32, justifyContent: 'center' },
  headerBack: { color: colors.onPrimary, fontSize: 34, lineHeight: 34 },
  moon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent },
  headerTitle: { color: colors.onPrimary, fontSize: font.heading, fontWeight: '700', marginTop: spacing.md, letterSpacing: 1, textAlign: 'center' },
  headerSubtitle: { color: colors.onPrimaryMuted, fontSize: font.small, marginTop: spacing.xs, textAlign: 'center' },
  button: {
    backgroundColor: colors.secondary, minHeight: MIN_TOUCH, borderRadius: radius.md, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: spacing.lg,
  },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.secondary },
  buttonDanger: { backgroundColor: colors.danger },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onPrimary, fontSize: font.body, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  title: { fontSize: font.title, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: font.heading, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  body: { fontSize: font.body, color: colors.text, lineHeight: 22 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 2 },
  infoLabel: { fontSize: font.small, color: colors.textMuted, flexShrink: 0 },
  infoValue: { fontSize: font.small, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  placeholder: { backgroundColor: colors.placeholder, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.text, fontWeight: '700', fontSize: font.small },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: font.tiny, fontWeight: '700' },
  banner: { borderRadius: radius.md, padding: spacing.md },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: font.small, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    minHeight: MIN_TOUCH, paddingHorizontal: spacing.md, fontSize: font.body, color: colors.text,
  },
  fieldError: { color: colors.danger, fontSize: font.tiny },
  fieldHint: { color: colors.textMuted, fontSize: font.tiny },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: MIN_TOUCH, paddingVertical: spacing.xs },
  checkbox: {
    width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: colors.secondary, alignItems: 'center',
    justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.secondary },
  stepper: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surface,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  stepBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 24, color: colors.secondary, fontWeight: '700' },
  stepValue: { minWidth: 40, textAlign: 'center', fontSize: font.heading, fontWeight: '700', color: colors.text },
  chip: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center',
  },
});
