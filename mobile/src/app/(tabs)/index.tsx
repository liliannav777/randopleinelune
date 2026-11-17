import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventCard } from '@/components/EventCard';
import { Banner, Body, Button, Card, Chips, Icon, LinkText, Screen, SectionTitle } from '@/components/ui';
import { listUpcomingEvents } from '@/lib/api';
import { capitalize, formatDate, formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import { heroPhoto, photoFor } from '@/lib/photos';
import { useColors, useLightStatusBar, useStyles, useTheme, type ThemePreference } from '@/lib/theme';
import { useFocusData } from '@/lib/useAsync';
import { fonts, spacing, type Colors } from '@/theme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Comme le téléphone' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

function Hero({ onDiscover }: { onDiscover: () => void }) {
  const s = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const photo = heroPhoto();
  return (
    <View style={[s.hero, { paddingTop: insets.top + spacing.xxl * 2 }]}>
      {photo ? <Image source={photo.source} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
      <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(8,14,24,0.55)', 'rgba(8,14,24,0.92)']}
        locations={[0, 0.25, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Text style={s.place}>Lyon · Beaujolais</Text>
      <Text style={s.title} accessibilityRole="header">Rando Pleine Lune</Text>
      <Text style={s.text}>
        Une autre expérience : la randonnée de nuit, à la lumière de la lune, entre vignes et villages de pierres dorées.
      </Text>
      <Button variant="gold" title="Voir les prochaines sorties" onPress={onDiscover} style={s.cta} />
      {photo ? <Text style={s.credit}>{photo.caption} — photo {photo.author}</Text> : null}
    </View>
  );
}

export default function Home() {
  useLightStatusBar();
  const { preference, setPreference } = useTheme();
  const colors = useColors();
  const s = useStyles(makeStyles);
  const router = useRouter();
  const { data: events, error, refreshing, refresh } = useFocusData(listUpcomingEvents);
  const { reservations } = useMyReservations();
  const next = events?.find((e) => e.status === 'published');
  const nextMine = reservations
    .filter((r) => r.status === 'confirmed' && new Date(r.event.starts_at) > new Date())
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at))[0];
  const galleryPhoto = photoFor('galerie');

  return (
    <Screen hero={<Hero onDiscover={() => router.push('/randonnees')} />} refreshing={refreshing} onRefresh={refresh}>
      {nextMine ? (
        <Card onPress={() => router.push(`/mes-reservations/${nextMine.id}`)} style={s.mine}
          accessibilityLabel={`Votre prochaine sortie : ${nextMine.event.title}`}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.mineLabel}>Votre prochaine sortie</Text>
            <Text style={s.mineTitle} numberOfLines={1}>{nextMine.event.title}</Text>
            <Text style={s.mineMeta}>
              {capitalize(formatDate(nextMine.event.starts_at))}, {formatTime(nextMine.event.starts_at)} · voir le billet
            </Text>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.textFaint} />
        </Card>
      ) : null}

      {error ? <Banner message={error.message} /> : null}

      {next ? (
        <>
          <SectionTitle action={<LinkText onPress={() => router.push('/randonnees')}>Toutes les dates</LinkText>}>
            Prochaine sortie
          </SectionTitle>
          <EventCard event={next} onPress={() => router.push(`/randonnees/${next.id}`)} />
        </>
      ) : null}

      <SectionTitle>Comment ça se passe</SectionTitle>
      <Body>
        La réservation est obligatoire : les groupes sont limités à 30 personnes. Vous recevez une confirmation
        par e-mail et un billet par participant, à montrer au départ.
      </Body>
      <Body>Le paiement se fait sur place, le jour de la sortie.</Body>
      <Body>
        Pensez à une lampe frontale, de bonnes chaussures et une couche chaude : les nuits sont fraîches sur les
        hauteurs.
      </Body>

      <Pressable onPress={() => router.push('/galerie')} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
        {galleryPhoto ? <Image source={galleryPhoto.source} style={s.rowThumb} contentFit="cover" /> : null}
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>Photos</Text>
          <Text style={s.rowText}>Le Beaujolais et nos sorties en images</Text>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.textFaint} />
      </Pressable>

      <View style={s.footer}>
        <LinkText onPress={() => router.push('/confidentialite')}>Conditions et confidentialité</LinkText>
        <LinkText onPress={() => router.push('/admin')}>Espace organisateur</LinkText>
        <Text style={s.footerLabel}>Apparence</Text>
        <Chips options={THEME_OPTIONS} value={preference} onChange={setPreference} />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, overflow: 'hidden', backgroundColor: colors.primary, minHeight: 520,
    justifyContent: 'flex-end',
  },
  place: { fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.9)' },
  title: { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 44, color: colors.onPrimary, marginTop: 2 },
  text: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.9)', marginTop: spacing.sm, maxWidth: 340 },
  cta: { marginTop: spacing.lg, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  credit: { fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: spacing.md },
  mine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.accent },
  mineLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.accentDark },
  mineTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  mineMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowThumb: { width: 56, height: 56, borderRadius: 6 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  rowText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  footer: { gap: spacing.sm, marginTop: spacing.lg },
  footerLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: spacing.md },
});
