import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { EventCover } from '@/components/EventCard';
import { Banner, Body, Button, Card, Header, Placeholder, Screen, SectionTitle, styles } from '@/components/ui';
import { listUpcomingEvents } from '@/lib/api';
import { capitalize, formatDate, formatDistance, formatShortDate, formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import { useFocusData } from '@/lib/useAsync';
import { colors, spacing } from '@/theme';

export default function Home() {
  const router = useRouter();
  const { data: events, error, refreshing, refresh } = useFocusData(listUpcomingEvents);
  const { reservations } = useMyReservations();
  const next = events?.find((e) => e.status === 'published');
  const upcomingMine = reservations.filter((r) => r.status === 'confirmed' && new Date(r.event.starts_at) > new Date());

  return (
    <Screen header={<Header title="Rando Pleine Lune" subtitle="Lyon Beaujolais" />} refreshing={refreshing} onRefresh={refresh}>
      <Placeholder label="Paysages du Beaujolais" height={150} />
      <Body style={{ fontWeight: '700' }}>Une autre expérience.</Body>
      <Body>Découvrez les randonnées nocturnes et les prochaines sorties.</Body>
      <Button title="Voir les randonnées" onPress={() => router.push('/randonnees')} />

      {error ? <Banner message={error.message} /> : null}

      {next ? (
        <>
          <SectionTitle>Prochaine sortie</SectionTitle>
          <Card onPress={() => router.push(`/randonnees/${next.id}`)} accessibilityLabel={`Prochaine sortie : ${next.title}`}>
            <EventCover uri={next.cover_image} height={120} />
            <Text style={[styles.body, { fontWeight: '700' }]}>{next.title}</Text>
            <Body muted>
              {capitalize(formatShortDate(next.starts_at))} • {formatTime(next.starts_at)}
              {next.distance_km != null ? ` • ${formatDistance(next.distance_km)}` : ''}
            </Body>
          </Card>
          <Button title="Réserver ma place" onPress={() => router.push(`/randonnees/${next.id}`)} />
        </>
      ) : null}

      {upcomingMine.length > 0 ? (
        <Card onPress={() => router.push('/mes-reservations')} accessibilityLabel="Mes réservations">
          <Text style={[styles.body, { fontWeight: '700' }]}>Mes réservations</Text>
          <Body muted>
            {upcomingMine.length === 1
              ? `${upcomingMine[0].event.title} — ${formatDate(upcomingMine[0].event.starts_at)}`
              : `${upcomingMine.length} sorties à venir`}
          </Body>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <Button variant="secondary" title="Mes réservations" style={{ flex: 1 }} onPress={() => router.push('/mes-reservations')} />
        <Button variant="secondary" title="Galerie" style={{ flex: 1 }} onPress={() => router.push('/galerie')} />
      </View>

      <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
        <Pressable onPress={() => router.push('/confidentialite')} accessibilityRole="link" hitSlop={8}>
          <Text style={{ color: colors.textMuted, textDecorationLine: 'underline' }}>Conditions et confidentialité</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/admin')} accessibilityRole="link" hitSlop={8}>
          <Text style={{ color: colors.textMuted }}>Espace organisateur</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
