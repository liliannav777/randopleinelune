import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  capitalize, difficultyLabel, formatDate, formatDistance, formatTariff, formatTime,
} from '@/lib/format';
import { photoFor } from '@/lib/photos';
import type { HikeEvent } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';
import { NightSky } from './art';
import { Badge, Card, Fact, Icon, ProgressBar, type IconName } from './ui';

export function eventStatusBadge(e: HikeEvent) {
  if (e.status === 'cancelled') return <Badge label="Annulée" tone="danger" />;
  if (e.status === 'closed') return <Badge label="Inscriptions closes" tone="neutral" />;
  if (e.status === 'completed') return <Badge label="Terminée" tone="neutral" />;
  if (e.status === 'draft') return <Badge label="Brouillon" tone="warning" />;
  if (e.seats_taken >= e.capacity) return <Badge label="Complet" tone="warning" />;
  if (e.capacity - e.seats_taken <= 5) return <Badge label="Dernières places" tone="accent" />;
  return <Badge label="Inscriptions ouvertes" tone="success" />;
}

/**
 * Photo de la sortie ; à défaut, une photo du Beaujolais intégrée à l'application
 * (teintée bleu nuit), choisie de façon stable selon la sortie.
 */
export function EventCover({ uri, height = 160, seed = 'rpl', hint, rounded = true, children }: {
  uri: string | null; height?: number; seed?: string; rounded?: boolean; children?: ReactNode;
  /** Titre et lieu de la sortie, pour choisir une photo du bon endroit. */
  hint?: string;
}) {
  const fallback = uri ? undefined : photoFor(seed, hint);
  return (
    <View style={[{ height, overflow: 'hidden', backgroundColor: colors.primary }, rounded && { borderRadius: radius.md }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors transition={200} />
      ) : fallback ? (
        <>
          <Image source={fallback.source} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          <LinearGradient colors={['rgba(11,22,38,0.30)', 'rgba(20,36,58,0.10)', 'rgba(11,22,38,0.45)']}
            style={StyleSheet.absoluteFill} pointerEvents="none" />
        </>
      ) : (
        <NightSky height={Math.max(120, Math.round(height * 0.9))} seed={seed} stars={28} />
      )}
      {children}
    </View>
  );
}

const MONTHS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];

export function DateBadge({ iso }: { iso: string }) {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'numeric' })
    .formatToParts(new Date(iso));
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  return (
    <View style={s.dateBadge}>
      <Text style={s.dateDay}>{day}</Text>
      <Text style={s.dateMonth}>{MONTHS[month - 1]}</Text>
    </View>
  );
}

export function eventFacts(e: Pick<HikeEvent, 'distance_km' | 'elevation_m' | 'difficulty' | 'starts_at'>, withTime = true) {
  const facts: { icon: IconName; label: string }[] = [];
  if (withTime) facts.push({ icon: 'time-outline', label: formatTime(e.starts_at) });
  if (e.distance_km != null) facts.push({ icon: 'walk-outline', label: formatDistance(e.distance_km)! });
  if (e.elevation_m != null) facts.push({ icon: 'trending-up-outline', label: `${e.elevation_m} m D+` });
  if (e.difficulty) facts.push({ icon: 'speedometer-outline', label: difficultyLabel[e.difficulty] });
  return facts;
}

export function SeatsMeter({ event }: { event: HikeEvent }) {
  const left = Math.max(0, event.capacity - event.seats_taken);
  return (
    <View style={{ gap: 6 }}>
      <View style={s.seatsRow}>
        <View style={s.seatsLabel}>
          <Icon name="people-outline" size={15} color={colors.textMuted} />
          <Text style={s.seatsText}>
            {left === 0 ? 'Complet' : `${left} place${left > 1 ? 's' : ''} disponible${left > 1 ? 's' : ''}`}
          </Text>
        </View>
        <Text style={s.seatsCap}>{event.seats_taken} / {event.capacity}</Text>
      </View>
      <ProgressBar value={event.seats_taken} max={event.capacity} />
    </View>
  );
}

export function EventCard({ event, onPress }: { event: HikeEvent; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ padding: 0, overflow: 'hidden', gap: 0 }}
      accessibilityLabel={`${event.title}, ${formatDate(event.starts_at)}`}>
      <EventCover uri={event.cover_image} height={150} seed={event.id} hint={`${event.title} ${event.meeting_point}`} rounded={false}>
        <View style={s.coverTop}>
          <DateBadge iso={event.starts_at} />
          <View style={s.price}><Text style={s.priceText}>{formatTariff(event.price_cents)}</Text></View>
        </View>
      </EventCover>
      <View style={s.body}>
        {eventStatusBadge(event)}
        <Text style={s.title} numberOfLines={2}>{event.title}</Text>
        <View style={s.place}>
          <Icon name="location-outline" size={15} color={colors.textMuted} />
          <Text style={s.placeText} numberOfLines={1}>
            {capitalize(formatDate(event.starts_at))} · {event.meeting_point}
          </Text>
        </View>
        <View style={s.facts}>
          {eventFacts(event).map((f) => <Fact key={f.icon} icon={f.icon} label={f.label} />)}
        </View>
        {event.status === 'published' ? <SeatsMeter event={event} /> : null}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  coverTop: {
    position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'flex-start',
  },
  dateBadge: {
    backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center', minWidth: 54,
  },
  dateDay: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.primary },
  dateMonth: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: colors.accentDark },
  price: { backgroundColor: 'rgba(11,22,38,0.72)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  priceText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentLight },
  body: { padding: spacing.lg, gap: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.text },
  place: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  placeText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, flex: 1 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  seatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  seatsLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seatsText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  seatsCap: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
});
