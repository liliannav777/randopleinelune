import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { DateBadge, EventCover } from '@/components/EventCard';
import { Badge, Banner, Button, Card, Empty, Header, Icon, Loading, Screen, SectionTitle } from '@/components/ui';
import { toAppError } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import type { Reservation } from '@/lib/types';
import { colors, fonts, spacing } from '@/theme';

function ReservationRow({ r, onPress, past }: { r: Reservation; onPress: () => void; past?: boolean }) {
  return (
    <Card onPress={onPress} style={[s.row, past && { opacity: 0.75 }]}
      accessibilityLabel={`${r.event.title}, ${r.participant_count} participant(s)`}>
      <View style={s.thumb}>
        <EventCover uri={r.event.cover_image} height={84} seed={r.event.id} hint={`${r.event.title} ${r.event.meeting_point}`} />
        <View style={s.thumbDate}><DateBadge iso={r.event.starts_at} /></View>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.title} numberOfLines={2}>{r.event.title}</Text>
        <View style={s.meta}>
          <Icon name="time-outline" size={14} color={colors.textMuted} />
          <Text style={s.metaText}>{formatTime(r.event.starts_at)}</Text>
          <Icon name="people-outline" size={14} color={colors.textMuted} />
          <Text style={s.metaText}>{r.participant_count}</Text>
        </View>
        {r.status === 'confirmed'
          ? <Badge label={past ? 'Passée' : 'Confirmée'} tone={past ? 'neutral' : 'success'} />
          : <Badge label={r.cancelled_by === 'event_cancelled' ? 'Sortie annulée' : 'Annulée'} tone="danger" />}
      </View>
      <Icon name="chevron-forward" size={20} color={colors.textFaint} />
    </Card>
  );
}

export default function MyReservations() {
  const router = useRouter();
  const { reservations, loading, error, refresh } = useMyReservations();
  const now = new Date();
  const upcoming = reservations.filter((r) => new Date(r.event.starts_at) >= now);
  const past = reservations.filter((r) => new Date(r.event.starts_at) < now).reverse();

  return (
    <Screen header={<Header title="Mes billets" subtitle="Sur cet appareil" seed="billets" />}
      refreshing={loading && reservations.length > 0} onRefresh={refresh}>
      {error ? <Banner message={toAppError(error).message} /> : null}
      {loading && reservations.length === 0 ? <Loading /> : null}
      {!loading && reservations.length === 0 ? (
        <Empty
          icon="ticket-outline"
          title="Aucun billet pour l’instant"
          message="Vos réservations apparaîtront ici. Sur un autre appareil, ouvrez le lien « Ouvrir ma réservation » reçu par e-mail."
          action={<Button variant="gold" icon="compass-outline" title="Découvrir les randonnées" onPress={() => router.push('/randonnees')} />}
        />
      ) : null}
      {upcoming.length > 0 ? <SectionTitle>À venir</SectionTitle> : null}
      {upcoming.map((r) => <ReservationRow key={r.id} r={r} onPress={() => router.push(`/mes-reservations/${r.id}`)} />)}
      {past.length > 0 ? <SectionTitle>Historique</SectionTitle> : null}
      {past.map((r) => <ReservationRow key={r.id} r={r} past onPress={() => router.push(`/mes-reservations/${r.id}`)} />)}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  thumb: { width: 84 },
  thumbDate: { position: 'absolute', top: 6, left: 6, transform: [{ scale: 0.78 }], transformOrigin: 'top left' },
  title: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginRight: 8 },
});
