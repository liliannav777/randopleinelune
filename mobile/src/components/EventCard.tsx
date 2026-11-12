import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { capitalize, difficultyLabel, formatDate, formatDistance, formatTariff, formatTime, seatsLeftLabel } from '@/lib/format';
import type { HikeEvent } from '@/lib/types';
import { colors, radius, spacing } from '@/theme';
import { Badge, Body, Card, Placeholder, styles } from './ui';

export function eventStatusBadge(e: HikeEvent) {
  if (e.status === 'cancelled') return <Badge label="Annulée" tone="danger" />;
  if (e.status === 'closed') return <Badge label="Inscriptions closes" tone="neutral" />;
  if (e.status === 'draft') return <Badge label="Brouillon" tone="warning" />;
  if (e.seats_taken >= e.capacity) return <Badge label="Complet" tone="warning" />;
  if (e.capacity - e.seats_taken <= 5) return <Badge label="Dernières places" tone="accent" />;
  return <Badge label="Inscriptions ouvertes" tone="success" />;
}

export function EventCover({ uri, height = 160 }: { uri: string | null; height?: number }) {
  if (!uri) return <Placeholder label="Photo de la sortie" height={height} />;
  return (
    <Image source={{ uri }} style={{ height, borderRadius: radius.md, backgroundColor: colors.placeholder }}
      contentFit="cover" accessibilityIgnoresInvertColors transition={150} />
  );
}

export function EventCard({ event, onPress }: { event: HikeEvent; onPress: () => void }) {
  const facts = [
    formatDistance(event.distance_km),
    event.elevation_m != null ? `D+ ${event.elevation_m} m` : null,
    event.difficulty ? difficultyLabel[event.difficulty] : null,
  ].filter(Boolean).join(' • ');

  return (
    <Card onPress={onPress} accessibilityLabel={`${event.title}, ${formatDate(event.starts_at)}`}>
      <EventCover uri={event.cover_image} height={130} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
        <Text style={[styles.body, { fontWeight: '700', flex: 1 }]}>{event.title}</Text>
      </View>
      {eventStatusBadge(event)}
      <Body muted>{capitalize(formatDate(event.starts_at))} • {formatTime(event.starts_at)} • {event.meeting_point}</Body>
      {facts ? <Body muted>{facts}</Body> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Body>{formatTariff(event.price_cents)}</Body>
        {event.status === 'published' ? <Body muted>{seatsLeftLabel(event.capacity, event.seats_taken)}</Body> : null}
      </View>
    </Card>
  );
}
