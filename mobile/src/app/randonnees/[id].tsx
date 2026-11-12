import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Text } from 'react-native';
import { EventCover, eventStatusBadge } from '@/components/EventCard';
import { Banner, Body, Button, Card, Empty, Header, InfoRow, Loading, Screen, SectionTitle, styles } from '@/components/ui';
import { getEvent } from '@/lib/api';
import {
  capitalize, difficultyLabel, formatDate, formatDistance, formatTariff, formatTime, seatsLeftLabel,
} from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import { useFocusData } from '@/lib/useAsync';
import { colors } from '@/theme';

export default function HikeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: event, error, loading, refreshing, refresh } = useFocusData(() => getEvent(id), [id]);
  const { reservations } = useMyReservations();
  const mine = reservations.find((r) => r.event.id === id && r.status === 'confirmed');

  const header = <Header title="Randonnée" subtitle={event ? formatDate(event.starts_at) : undefined} onBack={() => router.back()} />;
  if (loading && !event) return <Screen header={header}><Loading /></Screen>;
  if (!event) {
    return (
      <Screen header={header}>
        {error ? <Banner message={error.message} /> : <Empty title="Sortie introuvable" message="Elle a peut-être été retirée." />}
      </Screen>
    );
  }

  const full = event.seats_taken >= event.capacity;
  const open = event.status === 'published' && new Date(event.starts_at) > new Date();
  const canBook = open && !full && !mine;

  let footer;
  if (mine) {
    footer = <Button title="Voir ma réservation" onPress={() => router.push(`/mes-reservations/${mine.id}`)} />;
  } else if (canBook) {
    footer = (
      <>
        <Button title="Réserver ma place" onPress={() => router.push(`/reserver/${event.id}`)} />
        <Text style={[styles.fieldHint, { textAlign: 'center' }]}>Confirmation immédiate si places disponibles • Paiement sur place</Text>
      </>
    );
  }

  return (
    <Screen header={header} footer={footer} refreshing={refreshing} onRefresh={refresh}>
      <EventCover uri={event.cover_image} height={190} />
      <Text style={styles.title}>{event.title}</Text>
      {eventStatusBadge(event)}
      {event.status === 'cancelled' ? <Banner message="Cette sortie est annulée." /> : null}
      {open && full && !mine ? (
        <Banner tone="warning" message="Cette sortie est complète. Aucune liste d'attente pour le moment : surveillez les prochaines dates." />
      ) : null}
      {event.summary ? <Body>{event.summary}</Body> : null}

      <Card>
        <InfoRow label="Date" value={capitalize(formatDate(event.starts_at))} />
        <InfoRow label="Rendez-vous" value={formatTime(event.starts_at)} />
        <InfoRow label="Lieu" value={event.meeting_point} />
        {event.distance_km != null ? <InfoRow label="Distance" value={formatDistance(event.distance_km)} /> : null}
        {event.elevation_m != null ? <InfoRow label="Dénivelé" value={`${event.elevation_m} m`} /> : null}
        {event.difficulty ? <InfoRow label="Difficulté" value={difficultyLabel[event.difficulty]} /> : null}
        <InfoRow label="Tarif" value={formatTariff(event.price_cents)} />
        <InfoRow label="Capacité" value={open ? seatsLeftLabel(event.capacity, event.seats_taken) : `${event.capacity} participants`} />
      </Card>

      {event.meeting_point_url ? (
        <Button variant="secondary" title="Itinéraire vers le rendez-vous"
          onPress={() => Linking.openURL(event.meeting_point_url!)} />
      ) : null}

      {event.description ? (<><SectionTitle>Description</SectionTitle><Body>{event.description}</Body></>) : null}
      {event.equipment ? (<><SectionTitle>Équipement conseillé</SectionTitle><Body>{event.equipment}</Body></>) : null}
      {event.instructions ? (<><SectionTitle>Consignes</SectionTitle><Body>{event.instructions}</Body></>) : null}
      {event.ends_at ? <Body muted>Retour prévu vers {formatTime(event.ends_at)}.</Body> : null}
      <Body muted style={{ color: colors.textMuted }}>
        Paiement sur place le jour de la sortie.{' '}
        {event.cancellation_deadline_hours != null
          ? `Annulation possible depuis l'application jusqu'à ${event.cancellation_deadline_hours} h avant le départ.`
          : "Annulation possible depuis l'application, dans le délai fixé par l'organisateur."}
      </Body>
    </Screen>
  );
}
