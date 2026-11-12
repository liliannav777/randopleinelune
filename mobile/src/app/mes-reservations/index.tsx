import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Badge, Banner, Body, Button, Card, Empty, Header, Loading, Screen, SectionTitle, styles } from '@/components/ui';
import { toAppError } from '@/lib/errors';
import { capitalize, formatDate, formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import type { Reservation } from '@/lib/types';
import { spacing } from '@/theme';

function ReservationRow({ r, onPress }: { r: Reservation; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${r.event.title}, ${formatDate(r.event.starts_at)}`}>
      <Text style={[styles.body, { fontWeight: '700' }]}>{r.event.title}</Text>
      <Body muted>{capitalize(formatDate(r.event.starts_at))} • {formatTime(r.event.starts_at)}</Body>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {r.status === 'confirmed'
          ? <Badge label="Confirmée" tone="success" />
          : <Badge label={r.cancelled_by === 'event_cancelled' ? 'Sortie annulée' : 'Annulée'} tone="danger" />}
        <Badge label={`${r.participant_count} participant${r.participant_count > 1 ? 's' : ''}`} />
      </View>
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
    <Screen header={<Header title="Mes réservations" subtitle="Sur cet appareil" onBack={() => router.back()} />}
      refreshing={loading && reservations.length > 0} onRefresh={refresh}>
      {error ? <Banner message={toAppError(error).message} /> : null}
      {loading && reservations.length === 0 ? <Loading /> : null}
      {!loading && reservations.length === 0 ? (
        <Empty
          title="Aucune réservation"
          message="Vos réservations apparaîtront ici. Sur un autre appareil, ouvrez le lien « Ouvrir ma réservation » reçu par e-mail."
          action={<Button title="Voir les randonnées" onPress={() => router.push('/randonnees')} />}
        />
      ) : null}
      {upcoming.length > 0 ? <SectionTitle>À venir</SectionTitle> : null}
      {upcoming.map((r) => <ReservationRow key={r.id} r={r} onPress={() => router.push(`/mes-reservations/${r.id}`)} />)}
      {past.length > 0 ? <SectionTitle>Historique</SectionTitle> : null}
      {past.map((r) => <ReservationRow key={r.id} r={r} onPress={() => router.push(`/mes-reservations/${r.id}`)} />)}
    </Screen>
  );
}
