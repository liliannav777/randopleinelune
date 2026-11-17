import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { EventCover } from '@/components/EventCard';
import { Badge, Banner, Button, Card, Empty, Header, Icon, Loading, Screen, SectionTitle } from '@/components/ui';
import { toAppError } from '@/lib/errors';
import { capitalize, formatDate, formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import type { Reservation } from '@/lib/types';
import { fonts, spacing, type Colors } from '@/theme';
import { useColors, useStyles } from '@/lib/theme';

function ReservationRow({ r, onPress, past }: { r: Reservation; onPress: () => void; past?: boolean }) {
  const colors = useColors();
  const s = useStyles(makeStyles);
  return (
    <Card onPress={onPress} style={[s.row, past && { opacity: 0.75 }]}
      accessibilityLabel={`${r.event.title}, ${r.participant_count} participant(s)`}>
      <View style={s.thumb}>
        <EventCover uri={r.event.cover_image} height={64} seed={r.event.id} hint={`${r.event.title} ${r.event.meeting_point}`} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.title} numberOfLines={2}>{r.event.title}</Text>
        <Text style={s.metaText}>
          {capitalize(formatDate(r.event.starts_at))}, {formatTime(r.event.starts_at)}
        </Text>
        <Text style={s.metaText}>
          {r.participant_count} personne{r.participant_count > 1 ? 's' : ''}
        </Text>
        {r.status !== 'confirmed'
          ? <Badge label={r.cancelled_by === 'event_cancelled' ? 'Sortie annulée' : 'Annulée'} tone="danger" />
          : null}
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
    <Screen header={<Header title="Mes billets" subtitle="Les réservations faites depuis ce téléphone" />}
      refreshing={loading && reservations.length > 0} onRefresh={refresh}>
      {error ? <Banner message={toAppError(error).message} /> : null}
      {loading && reservations.length === 0 ? <Loading /> : null}
      {!loading && reservations.length === 0 ? (
        <Empty
          title="Aucun billet pour l’instant"
          message="Vos réservations apparaîtront ici. Sur un autre appareil, ouvrez le lien « Ouvrir ma réservation » reçu par e-mail."
          action={<Button variant="gold" title="Découvrir les randonnées" onPress={() => router.push('/randonnees')} />}
        />
      ) : null}
      {upcoming.length > 0 ? <SectionTitle>À venir</SectionTitle> : null}
      {upcoming.map((r) => <ReservationRow key={r.id} r={r} onPress={() => router.push(`/mes-reservations/${r.id}`)} />)}
      {past.length > 0 ? <SectionTitle>Historique</SectionTitle> : null}
      {past.map((r) => <ReservationRow key={r.id} r={r} past onPress={() => router.push(`/mes-reservations/${r.id}`)} />)}
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  thumb: { width: 64 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, color: colors.text },
  metaText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
});
