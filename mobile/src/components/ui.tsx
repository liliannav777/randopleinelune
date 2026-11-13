// Composants d'interface partagés — univers « nuit étoilée » (Spécifications V1 §4).
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, useShadow, useStyles } from '@/lib/theme';
import { font, fonts, MIN_TOUCH, radius, shadow, spacing, type Colors } from '@/theme';
import { NightSky } from './art';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color?: string }) {
  const colors = useColors();
  return <Ionicons name={name} size={size} color={color ?? colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />;
}

function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// En-tête : ciel étoilé, lune et collines
// ---------------------------------------------------------------------------
export function IconButton({ icon, onPress, label, tone = 'light' }: {
  icon: IconName; onPress: () => void; label: string; tone?: 'light' | 'dark';
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={({ pressed }) => [styles.iconButton, tone === 'dark' && styles.iconButtonDark, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={22} color={tone === 'light' ? colors.onPrimary : colors.primary} />
    </Pressable>
  );
}

export function Header({ title, subtitle, onBack, right, seed }: {
  title: string; subtitle?: string; onBack?: () => void; right?: ReactNode; seed?: string;
}) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <NightSky height={170} seed={seed ?? title} moon={{ x: 255, y: 50, r: 15 }} stars={34} />
      <View style={styles.headerRow}>
        {onBack ? <IconButton icon="chevron-back" onPress={onBack} label="Retour" /> : <View style={styles.headerSpacer} />}
        <View style={styles.headerSpacer}>{right}</View>
      </View>
      <View style={styles.headerText}>
        {subtitle ? <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle.toUpperCase()}</Text> : null}
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={2}>{title}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Écran défilant standard
// ---------------------------------------------------------------------------
export function Screen({ header, hero, children, refreshing, onRefresh, footer, contentStyle }: {
  /** En-tête fixe. */
  header?: ReactNode;
  /** Visuel d'en-tête qui défile avec le contenu (le contenu peut le chevaucher). */
  hero?: ReactNode;
  children: ReactNode; refreshing?: boolean; onRefresh?: () => void; footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={hero ? undefined : [styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.secondary]} />
        ) : undefined}
      >
        {hero ? <>{hero}<View style={[styles.content, contentStyle]}>{children}</View></> : children}
      </ScrollView>
      {footer ? <SafeAreaView edges={['bottom']} style={styles.footer}>{footer}</SafeAreaView> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------------------
type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'danger' | 'ghost';

const buttonColors = (colors: Colors): Record<ButtonVariant, { bg: string; fg: string; border?: string }> => ({
  primary: { bg: colors.secondary, fg: colors.onPrimary },
  gold: { bg: colors.accent, fg: colors.primary },
  secondary: { bg: colors.surface, fg: colors.link, border: colors.borderStrong },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  ghost: { bg: 'transparent', fg: colors.link },
});

export function Button({ title, onPress, variant = 'primary', disabled, loading, accessibilityHint, style, icon, small }: {
  title: string; onPress: () => void; variant?: ButtonVariant;
  disabled?: boolean; loading?: boolean; accessibilityHint?: string; style?: StyleProp<ViewStyle>;
  icon?: IconName; small?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const sh = useShadow();
  const colors = useColors();
  const inactive = disabled || loading;
  const c = buttonColors(colors)[variant];
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: c.bg },
        c.border ? { borderWidth: 1.5, borderColor: c.border } : null,
        (variant === 'primary' || variant === 'gold') && !inactive ? sh(1) : null,
        inactive && styles.buttonDisabled,
        pressed && !inactive && { transform: [{ scale: 0.985 }], opacity: 0.92 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={c.fg} /> : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} size={small ? 16 : 19} color={c.fg} /> : null}
          <Text style={[styles.buttonText, small && { fontSize: font.small }, { color: c.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Blocs de contenu
// ---------------------------------------------------------------------------
export function Card({ children, style, onPress, accessibilityLabel, flat }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string; flat?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const sh = useShadow();
  const base = [styles.card, !flat && sh(1), style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [...base, pressed && { transform: [{ scale: 0.99 }], opacity: 0.96 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const styles = useStyles(makeStyles);
  return <Text style={[styles.title, style]} accessibilityRole="header">{children}</Text>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{children}</Text>
      {action}
    </View>
  );
}

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return <Text style={[styles.eyebrow, { color: color ?? colors.accentDark }]}>{children}</Text>;
}

export function Body({ children, muted, style, strong }: { children: ReactNode; muted?: boolean; strong?: boolean; style?: StyleProp<TextStyle> }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return <Text style={[styles.body, muted && { color: colors.textMuted }, strong && styles.strong, style]}>{children}</Text>;
}

export function InfoRow({ label, value, icon }: { label: string; value: ReactNode; icon?: IconName }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelWrap}>
        {icon ? <Icon name={icon} size={16} color={colors.textFaint} /> : null}
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/** Fait clé avec icône (distance, dénivelé, horaire…). */
export function Fact({ icon, label, light }: { icon: IconName; label: string; light?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.fact, light && styles.factLight]}>
      <Icon name={icon} size={14} color={light ? colors.accentLight : colors.link} />
      <Text style={[styles.factText, light && { color: colors.onPrimary }]}>{label}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.divider, style]} />;
}

export function Placeholder({ label, height = 140 }: { label: string; height?: number }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.placeholder, { height }]}>
      <Text style={styles.placeholderText}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'primary' | 'success' }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const fill = tone === 'accent' ? colors.accent : tone === 'success' ? colors.success : colors.secondary;
  return (
    <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: fill }]} />
    </View>
  );
}

export function StatTile({ icon, label, value, sub }: { icon: IconName; label: string; value: string; sub?: string }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const sh = useShadow();
  return (
    <View style={[styles.statTile, sh(1)]}>
      <View style={styles.statIcon}><Icon name={icon} size={18} color={colors.accentDark} /></View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'night';
const toneStyle = (colors: Colors): Record<Tone, { bg: string; fg: string }> => ({
  neutral: { bg: colors.neutralBg, fg: colors.neutralFg },
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  accent: { bg: colors.accentSoft, fg: colors.accentDark },
  night: { bg: 'rgba(11,22,38,0.72)', fg: colors.accentLight },
});

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const t = toneStyle(colors)[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <Icon name={icon} size={12} color={t.fg} /> : <View style={[styles.badgeDot, { backgroundColor: t.fg }]} />}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const bannerIcon: Record<Tone, IconName> = {
  neutral: 'information-circle', success: 'checkmark-circle', warning: 'alert-circle', danger: 'alert-circle',
  accent: 'moon', night: 'moon',
};

export function Banner({ message, tone = 'danger', title }: { message: string; tone?: Tone; title?: string }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const t = toneStyle(colors)[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name={bannerIcon[tone]} size={20} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={[styles.bannerTitle, { color: t.fg }]}>{title}</Text> : null}
        <Text style={[styles.bannerText, { color: t.fg }]}>{message}</Text>
      </View>
    </View>
  );
}

export function Loading() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
}

export function Empty({ title, message, action, icon = 'moon-outline' }: { title: string; message?: string; action?: ReactNode; icon?: IconName }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon name={icon} size={30} color={colors.accentDark} /></View>
      <Text style={[styles.sectionTitle, { textAlign: 'center' }]}>{title}</Text>
      {message ? <Body muted style={{ textAlign: 'center' }}>{message}</Body> : null}
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Formulaires
// ---------------------------------------------------------------------------
export function Field({ label, error, hint, icon, ...props }: TextInputProps & { label: string; error?: string; hint?: string; icon?: IconName }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[
        styles.inputWrap,
        props.multiline && { alignItems: 'flex-start', paddingTop: spacing.md },
        focused && styles.inputFocused,
        !!error && { borderColor: colors.danger },
      ]}>
        {icon ? <Icon name={icon} size={18} color={focused ? colors.link : colors.textFaint} /> : null}
        <TextInput
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          {...props}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 0 }, props.style]}
        />
      </View>
      {error ? (
        <View style={styles.fieldMsg}><Icon name="alert-circle" size={13} color={colors.danger} /><Text style={styles.fieldError}>{error}</Text></View>
      ) : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Pressable onPress={() => { tap(); onChange(!checked); }} accessibilityRole="checkbox" accessibilityState={{ checked }}
      style={styles.checkboxRow} hitSlop={6}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Icon name="checkmark" size={17} color={colors.onPrimary} /> : null}
      </View>
      <Text style={[styles.body, { flex: 1, fontSize: font.small, lineHeight: 20 }]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ value, min, max, onChange, label }: {
  value: number; min: number; max: number; onChange: (v: number) => void; label: string;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const btn = (delta: number, icon: IconName, a11y: string, disabled: boolean) => (
    <Pressable style={[styles.stepBtn, disabled && { opacity: 0.35 }]} disabled={disabled} accessibilityLabel={a11y}
      onPress={() => { tap(); onChange(Math.min(max, Math.max(min, value + delta))); }}>
      <Icon name={icon} size={22} color={colors.onPrimary} />
    </Pressable>
  );
  return (
    <View style={styles.stepperRow}>
      <Text style={[styles.fieldLabel, { flex: 1 }]}>{label}</Text>
      <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value - 1));
        }}>
        {btn(-1, 'remove', 'Retirer un participant', value <= min)}
        <Text style={styles.stepValue}>{value}</Text>
        {btn(1, 'add', 'Ajouter un participant', value >= max)}
      </View>
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { tap(); onChange(o.value); }} accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && { color: colors.onPrimary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function LinkText({ children, onPress, icon }: { children: ReactNode; onPress: () => void; icon?: IconName }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={8} style={styles.link}>
      {icon ? <Icon name={icon} size={16} color={colors.link} /> : null}
      <Text style={styles.linkText}>{children}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, backgroundColor: colors.surface, gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, ...shadow(2),
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, minHeight: 160 },
  header: {
    backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  headerSpacer: { minWidth: 44, alignItems: 'flex-end' },
  headerText: { marginTop: spacing.md, gap: 4 },
  headerTitle: { color: colors.onPrimary, fontFamily: fonts.display, fontSize: font.title, lineHeight: 32 },
  headerSubtitle: { color: colors.accentLight, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.6 },
  iconButton: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)',
  },
  iconButtonDark: { backgroundColor: colors.surface, borderColor: colors.border },
  button: {
    minHeight: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg,
  },
  buttonSmall: { minHeight: 42, borderRadius: radius.sm + 2, paddingHorizontal: spacing.md },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.semibold, fontSize: font.body, letterSpacing: 0.2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: font.title, lineHeight: 32, color: colors.text },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  sectionTitle: { fontFamily: fonts.display, fontSize: font.heading, color: colors.text },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  body: { fontFamily: fonts.regular, fontSize: font.body, color: colors.text, lineHeight: 24 },
  strong: { fontFamily: fonts.semibold },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  infoLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  infoLabel: { fontFamily: fonts.regular, fontSize: font.small, color: colors.textMuted },
  infoValue: { fontFamily: fonts.semibold, fontSize: font.small, color: colors.text, flexShrink: 1, textAlign: 'right' },
  fact: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.chip, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  factLight: { backgroundColor: 'rgba(255,255,255,0.14)' },
  factText: { fontFamily: fonts.medium, fontSize: 13, color: colors.link },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.xs },
  placeholder: { backgroundColor: colors.placeholder, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.text, fontFamily: fonts.semibold, fontSize: font.small },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  statTile: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 2,
  },
  statIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center',
    justifyContent: 'center', marginBottom: spacing.sm,
  },
  statValue: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  statLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  statSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12 },
  banner: { flexDirection: 'row', gap: spacing.md, borderRadius: radius.md, padding: spacing.md, alignItems: 'flex-start' },
  bannerTitle: { fontFamily: fonts.semibold, fontSize: font.small },
  bannerText: { fontFamily: fonts.regular, fontSize: font.small, lineHeight: 20 },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  field: { gap: 6 },
  fieldLabel: { fontFamily: fonts.medium, fontSize: font.small, color: colors.text },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1.5,
    borderColor: colors.border, borderRadius: radius.md, minHeight: 52, paddingHorizontal: spacing.md,
  },
  inputFocused: { borderColor: colors.link, backgroundColor: colors.surface },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: font.body, color: colors.text, paddingVertical: 12, minHeight: 48 },
  fieldMsg: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldError: { color: colors.danger, fontFamily: fonts.medium, fontSize: font.tiny },
  fieldHint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: font.tiny, lineHeight: 17 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: MIN_TOUCH, paddingVertical: spacing.xs },
  checkbox: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center',
    justifyContent: 'center', marginTop: 1, backgroundColor: colors.surface,
  },
  checkboxChecked: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, paddingLeft: spacing.lg, borderWidth: 1.5, borderColor: colors.border,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary,
  },
  stepValue: { minWidth: 34, textAlign: 'center', fontFamily: fonts.display, fontSize: 24, color: colors.text },
  chip: {
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: 14, minHeight: 38, justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 },
  linkText: { fontFamily: fonts.medium, fontSize: font.small, color: colors.link, textDecorationLine: 'underline' },
});

/** Styles partagés (titres, textes d'aide…) pour les écrans, adaptés au thème actif. */
export function useUiStyles() {
  return useStyles(makeStyles);
}
