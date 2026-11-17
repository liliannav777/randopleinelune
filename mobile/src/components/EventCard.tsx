import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  capitalize, difficultyLabel, formatDate, formatDistance, formatTariff, formatTime,
} from '@/lib/format';
import { photoFor } from '@/lib/photos';
import type { HikeEvent } from '@/lib/types';
import { fonts, radius, spacing, type Colors } from '@/theme';
import { NightSky } from './art';
import { Badge, Card, ProgressBar, type IconName } from './ui';
import { useColors, useStyles } from '@/lib/theme';

/** Étiquette d'état, seulement quand elle apporte une information (sinon null). */
export function eventStatusBadge(e: HikeEvent, always = false) {
  if (e.status === 'cancelled') return <Badge label="Annulée" tone="danger" />;
  if (e.status === 'closed') return <Badge label="Inscriptions closes" tone="neutral" />;
  if (e.status === 'completed') return <Badge label="Terminée" tone="neutral" />;
  if (e.status === 'draft') return <Badge label="Brouillon" tone="warning" />;
  if (e.seats_taken >= e.capacity) return <Badge label="Complet" tone="warning" />;
  if (e.capacity - e.seats_taken <= 5) return <Badge label="Dernières places" tone="accent" />;
  return always ? <Badge label="Inscriptions ouvertes" tone="success" /> : null;
}

const LEVEL: Record<NonNullable<HikeEvent['difficulty']>, string> = {
  facile: 'facile', moyenne: 'moyen', soutenue: 'soutenu', difficile: 'difficile',
};

/** « 11,5 km · 320 m de dénivelé · niveau moyen » */
export function factsLine(e: Pick<HikeEvent, 'distance_km' | 'elevation_m' | 'difficulty'>): string {
  return [
    e.distance_km != null ? formatDistance(e.distance_km) : null,
    e.elevation_m != null ? `${e.elevation_m} m de dénivelé` : null,
    e.difficulty ? `niveau ${LEVEL[e.difficulty]}` : null,
  ].filter(Boolean).join(' · ');
}

export function seatsLabel(e: Pick<HikeEvent, 'capacity' | 'seats_taken'>): string {
  const left = Math.max(0, e.capacity - e.seats_taken);
  if (left === 0) return 'Complet';
  return `${left} place${left > 1 ? 's' : ''} sur ${e.capacity}`;
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
  const colors = useColors();
  const fallback = uri ? undefined : photoFor(seed, hint);
  return (
    <View style={[{ height, overflow: 'hidden', backgroundColor: colors.primary }, rounded && { borderRadius: radius.md }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors transition={200} />
      ) : fallback ? (
        <Image source={fallback.source} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <NightSky height={Math.max(120, Math.round(height * 0.9))} seed={seed} stars={28} />
      )}
      {children}
    </View>
  );
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function DateBadge({ iso }: { iso: string }) {
  const s = useStyles(makeStyles);
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
  const s = useStyles(makeStyles);
  const left = Math.max(0, event.capacity - event.seats_taken);
  return (
    <View style={{ gap: 6 }}>
      <View style={s.seatsRow}>
        <Text style={s.seatsText}>
          {left === 0 ? 'Complet' : `Encore ${left} place${left > 1 ? 's' : ''}`}
        </Text>
        <Text style={s.seatsCap}>{event.seats_taken} inscrits sur {event.capacity}</Text>
      </View>
      <ProgressBar value={event.seats_taken} max={event.capacity} />
    </View>
  );
}

export function EventCard({ event, onPress }: { event: HikeEvent; onPress: () => void }) {
  const colors = useColors();
  const s = useStyles(makeStyles);
  const left = event.capacity - event.seats_taken;
  const facts = factsLine(event);
  return (
    <Card onPress={onPress} style={{ padding: 0, overflow: 'hidden', gap: 0 }}
      accessibilityLabel={`${event.title}, ${formatDate(event.starts_at)}`}>
      <EventCover uri={event.cover_image} height={160} seed={event.id} hint={`${event.title} ${event.meeting_point}`} rounded={false}>
        <View style={s.coverTop}><DateBadge iso={event.starts_at} /></View>
      </EventCover>
      <View style={s.body}>
        {eventStatusBadge(event)}
        <Text style={s.title} numberOfLines={2}>{event.title}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {capitalize(formatDate(event.starts_at))}, {formatTime(event.starts_at)} — {event.meeting_point}
        </Text>
        {facts ? <Text style={s.meta}>{facts}</Text> : null}
        <View style={s.bottom}>
          <Text style={s.price}>{formatTariff(event.price_cents)}</Text>
          {event.status === 'published' ? (
            <Text style={[s.seats, left <= 5 && { color: colors.warning }]}>{seatsLabel(event)}</Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  coverTop: { position: 'absolute', top: spacing.md, left: spacing.md },
  dateBadge: {
    backgroundColor: colors.white, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, alignItems: 'center', minWidth: 46,
  },
  dateDay: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24, color: colors.primary },
  dateMonth: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 14, color: colors.primary },
  body: { padding: spacing.lg, gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.text, marginTop: 2 },
  meta: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm },
  price: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  seats: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  seatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  seatsText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  seatsCap: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
});
