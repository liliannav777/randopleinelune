import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoonMark, NightSky } from '@/components/art';
import { EventCard } from '@/components/EventCard';
import { Banner, Body, Button, Card, Icon, LinkText, Screen, SectionTitle, type IconName } from '@/components/ui';
import { listUpcomingEvents } from '@/lib/api';
import { capitalize, formatDate, formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import { heroPhoto } from '@/lib/photos';
import { useFocusData } from '@/lib/useAsync';
import { colors, fonts, radius, spacing } from '@/theme';

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'moon-outline', title: 'Sous la pleine lune', text: 'Des sorties nocturnes encadrées, au rythme de la nuit.' },
  { icon: 'people-outline', title: 'En petit groupe', text: '30 marcheurs au maximum pour garder la magie du silence.' },
  { icon: 'qr-code-outline', title: 'Simple et sans compte', text: 'Réservez en une minute, présentez votre billet, réglez sur place.' },
];

function Hero({ onDiscover }: { onDiscover: () => void }) {
  const insets = useSafeAreaInsets();
  const photo = heroPhoto();
  return (
    <View style={[s.hero, { paddingTop: insets.top + spacing.xl }]}>
      {photo ? (
        <>
          <Image source={photo.source} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          <LinearGradient colors={['rgba(11,22,38,0.78)', 'rgba(11,22,38,0.35)', 'rgba(11,22,38,0.92)']}
            locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        </>
      ) : <NightSky height={460} seed="accueil" moon={{ x: 300, y: 92, r: 30 }} stars={70} />}
      <View style={s.heroBrand}>
        <MoonMark size={30} />
        <Text style={s.heroEyebrow}>LYON · BEAUJOLAIS</Text>
      </View>
      <Text style={s.heroTitle} accessibilityRole="header">Rando{'\n'}Pleine Lune</Text>
      <Text style={s.heroTagline}>Une autre expérience.</Text>
      <Text style={s.heroText}>Randonnées nocturnes entre vignes et pierres dorées, à la lumière de la lune.</Text>
      <Button variant="gold" icon="compass-outline" title="Voir les randonnées" onPress={onDiscover} style={s.heroCta} />
      {photo ? <Text style={s.heroCredit}>Photo : {photo.caption} — {photo.author}</Text> : null}
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { data: events, error, refreshing, refresh } = useFocusData(listUpcomingEvents);
  const { reservations } = useMyReservations();
  const next = events?.find((e) => e.status === 'published');
  const upcomingMine = reservations
    .filter((r) => r.status === 'confirmed' && new Date(r.event.starts_at) > new Date())
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));
  const nextMine = upcomingMine[0];

  return (
    <Screen hero={<Hero onDiscover={() => router.push('/randonnees')} />} refreshing={refreshing} onRefresh={refresh}
      contentStyle={{ marginTop: -spacing.xl }}>
      {nextMine ? (
        <Card onPress={() => router.push(`/mes-reservations/${nextMine.id}`)} style={s.myTicket}
          accessibilityLabel={`Mon prochain billet : ${nextMine.event.title}`}>
          <View style={s.myTicketIcon}><Icon name="ticket" size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.myTicketEyebrow}>VOTRE PROCHAINE SORTIE</Text>
            <Text style={s.myTicketTitle} numberOfLines={1}>{nextMine.event.title}</Text>
            <Text style={s.myTicketMeta}>
              {capitalize(formatDate(nextMine.event.starts_at))} · {formatTime(nextMine.event.starts_at)}
            </Text>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.textFaint} />
        </Card>
      ) : null}

      {error ? <Banner message={error.message} /> : null}

      {next ? (
        <>
          <SectionTitle action={<LinkText onPress={() => router.push('/randonnees')}>Tout voir</LinkText>}>
            Prochaine sortie
          </SectionTitle>
          <EventCard event={next} onPress={() => router.push(`/randonnees/${next.id}`)} />
        </>
      ) : null}

      <SectionTitle>L’esprit des sorties</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {PROMISES.map((p) => (
          <View key={p.title} style={s.promise}>
            <View style={s.promiseIcon}><Icon name={p.icon} size={20} color={colors.accentDark} /></View>
            <View style={{ flex: 1 }}>
              <Body strong>{p.title}</Body>
              <Body muted style={{ fontSize: 14, lineHeight: 20 }}>{p.text}</Body>
            </View>
          </View>
        ))}
      </View>

      <Pressable onPress={() => router.push('/galerie')} accessibilityRole="button" style={s.gallery}>
        <NightSky height={120} seed="galerie" moon={{ x: 340, y: 34, r: 12 }} stars={30} />
        <View style={{ flex: 1 }}>
          <Text style={s.galleryTitle}>Galerie</Text>
          <Text style={s.galleryText}>Revivez nos dernières nuits de randonnée</Text>
        </View>
        <Icon name="images-outline" size={24} color={colors.accentLight} />
      </Pressable>

      <View style={s.footerLinks}>
        <LinkText icon="shield-checkmark-outline" onPress={() => router.push('/confidentialite')}>Conditions et confidentialité</LinkText>
        <LinkText icon="lock-closed-outline" onPress={() => router.push('/admin')}>Espace organisateur</LinkText>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl + spacing.xl, overflow: 'hidden',
    borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, backgroundColor: colors.primary,
  },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroCredit: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl + 4, fontFamily: fonts.regular, fontSize: 10,
    color: 'rgba(255,255,255,0.65)', maxWidth: 240, textAlign: 'right',
  },
  heroEyebrow: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 2.4, color: colors.accentLight },
  heroTitle: { fontFamily: fonts.displayBold, fontSize: 44, lineHeight: 48, color: colors.onPrimary, marginTop: spacing.sm },
  heroTagline: { fontFamily: fonts.displayItalic, fontSize: 20, color: colors.accentLight, marginTop: spacing.md },
  heroText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.onPrimaryMuted, marginTop: spacing.sm, maxWidth: 300 },
  heroCta: { marginTop: spacing.xl, alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  myTicket: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.accent },
  myTicketIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  myTicketEyebrow: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.4, color: colors.accentDark },
  myTicketTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
  myTicketMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  promise: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: spacing.xs },
  promiseIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  gallery: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, overflow: 'hidden',
    padding: spacing.lg, minHeight: 96, marginTop: spacing.sm, backgroundColor: colors.primary,
  },
  galleryTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.onPrimary },
  galleryText: { fontFamily: fonts.regular, fontSize: 13, color: colors.onPrimaryMuted },
  footerLinks: { gap: spacing.xs, marginTop: spacing.lg, alignItems: 'center' },
});
