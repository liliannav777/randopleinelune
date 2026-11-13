import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventCover, eventStatusBadge, SeatsMeter } from '@/components/EventCard';
import {
  Banner, Body, Button, Card, Empty, Header, Icon, IconButton, InfoRow, Loading, Screen, SectionTitle, type IconName,
} from '@/components/ui';
import { getEvent } from '@/lib/api';
import { capitalize, difficultyLabel, formatDate, formatDistance, formatPrice, formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import type { HikeEvent } from '@/lib/types';
import { useFocusData } from '@/lib/useAsync';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

function Hero({ event, onBack }: { event: HikeEvent; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <EventCover uri={event.cover_image} height={300 + insets.top} seed={event.id} hint={`${event.title} ${event.meeting_point}`} rounded={false}>
      <LinearGradient colors={['rgba(11,22,38,0.55)', 'rgba(11,22,38,0)', 'rgba(11,22,38,0.88)']}
        locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={[s.heroTop, { top: insets.top + spacing.sm }]}>
        <IconButton icon="chevron-back" onPress={onBack} label="Retour" />
      </View>
      <View style={s.heroBottom}>
        {eventStatusBadge(event)}
        <Text style={s.heroTitle} accessibilityRole="header">{event.title}</Text>
        <View style={s.heroMeta}>
          <Icon name="calendar-outline" size={15} color={colors.accentLight} />
          <Text style={s.heroMetaText}>{capitalize(formatDate(event.starts_at))} · {formatTime(event.starts_at)}</Text>
        </View>
      </View>
    </EventCover>
  );
}

function FactTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={s.factTile}>
      <Icon name={icon} size={20} color={colors.accentDark} />
      <Text style={s.factValue}>{value}</Text>
      <Text style={s.factLabel}>{label}</Text>
    </View>
  );
}

export default function HikeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: event, error, loading, refreshing, refresh } = useFocusData(() => getEvent(id), [id]);
  const { reservations } = useMyReservations();
  const mine = reservations.find((r) => r.event.id === id && r.status === 'confirmed');

  if (!event) {
    return (
      <Screen header={<Header title="Randonnée" onBack={() => router.back()} />}>
        {loading ? <Loading /> : error ? <Banner message={error.message} />
          : <Empty title="Sortie introuvable" message="Elle a peut-être été retirée." />}
      </Screen>
    );
  }

  const full = event.seats_taken >= event.capacity;
  const open = event.status === 'published' && new Date(event.starts_at) > new Date();
  const canBook = open && !full && !mine;

  let footer;
  if (mine) {
    footer = <Button variant="gold" icon="ticket-outline" title="Voir mon billet" onPress={() => router.push(`/mes-reservations/${mine.id}`)} />;
  } else if (canBook) {
    footer = (
      <View style={s.bookBar}>
        <View>
          <Text style={s.price}>{event.price_cents ? formatPrice(event.price_cents) : 'Gratuit'}</Text>
          <Text style={s.priceSub}>{event.price_cents ? 'par personne · sur place' : 'sur réservation'}</Text>
        </View>
        <Button variant="gold" title="Réserver" icon="arrow-forward" onPress={() => router.push(`/reserver/${event.id}`)} style={{ flex: 1 }} />
      </View>
    );
  }

  const facts: { icon: IconName; label: string; value: string }[] = [
    { icon: 'time-outline', label: 'Rendez-vous', value: formatTime(event.starts_at) },
  ];
  if (event.distance_km != null) facts.push({ icon: 'walk-outline', label: 'Distance', value: formatDistance(event.distance_km)! });
  if (event.elevation_m != null) facts.push({ icon: 'trending-up-outline', label: 'Dénivelé', value: `${event.elevation_m} m` });
  if (event.difficulty) facts.push({ icon: 'speedometer-outline', label: 'Niveau', value: difficultyLabel[event.difficulty] });

  return (
    <Screen hero={<Hero event={event} onBack={() => router.back()} />} footer={footer} refreshing={refreshing} onRefresh={refresh}>
      <View style={s.facts}>{facts.map((f) => <FactTile key={f.label} {...f} />)}</View>

      {event.status === 'cancelled' ? <Banner title="Sortie annulée" message="Cette sortie n’aura pas lieu." /> : null}
      {open && full && !mine ? (
        <Banner tone="warning" title="Complet" message="Aucune liste d’attente pour le moment : surveillez les prochaines dates." />
      ) : null}
      {mine ? <Banner tone="success" title="Vous êtes inscrit·e" message="Votre billet est dans l’onglet « Mes billets »." /> : null}

      {event.summary ? <Body style={s.lead}>{event.summary}</Body> : null}
      {open ? <Card><SeatsMeter event={event} /></Card> : null}

      <SectionTitle>Rendez-vous</SectionTitle>
      <Card>
        <InfoRow icon="location-outline" label="Lieu" value={event.meeting_point} />
        <InfoRow icon="time-outline" label="Heure" value={formatTime(event.starts_at)} />
        {event.ends_at ? <InfoRow icon="flag-outline" label="Retour prévu" value={formatTime(event.ends_at)} /> : null}
        {event.meeting_point_url ? (
          <Button variant="secondary" small icon="navigate-outline" title="Itinéraire"
            onPress={() => Linking.openURL(event.meeting_point_url!)} style={{ marginTop: spacing.sm }} />
        ) : null}
      </Card>

      {event.description ? (<><SectionTitle>La sortie</SectionTitle><Body>{event.description}</Body></>) : null}
      {event.equipment ? (
        <>
          <SectionTitle>Équipement conseillé</SectionTitle>
          <Card flat style={s.tip}>
            <Icon name="flashlight-outline" size={20} color={colors.accentDark} />
            <Body style={{ flex: 1 }}>{event.equipment}</Body>
          </Card>
        </>
      ) : null}
      {event.instructions ? (
        <>
          <SectionTitle>Consignes</SectionTitle>
          <Card flat style={s.tip}>
            <Icon name="information-circle-outline" size={20} color={colors.accentDark} />
            <Body style={{ flex: 1 }}>{event.instructions}</Body>
          </Card>
        </>
      ) : null}

      <View style={s.note}>
        <Icon name="card-outline" size={16} color={colors.textMuted} />
        <Body muted style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>
          Paiement sur place le jour de la sortie.{' '}
          {event.cancellation_deadline_hours != null
            ? `Annulation possible depuis l’application jusqu’à ${event.cancellation_deadline_hours} h avant le départ.`
            : 'Annulation possible depuis l’application, dans le délai fixé par l’organisateur.'}
        </Body>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  heroTop: { position: 'absolute', left: spacing.lg },
  heroBottom: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.xxl + spacing.xl, gap: spacing.sm },
  heroTitle: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36, color: colors.onPrimary },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroMetaText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onPrimary },
  facts: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.xxl - spacing.sm },
  factTile: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.md,
    alignItems: 'center', gap: 3, ...shadow(2),
  },
  factValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, textAlign: 'center' },
  factLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  lead: { fontSize: 17, lineHeight: 26, marginTop: spacing.sm },
  tip: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.accentSoft, alignItems: 'flex-start' },
  note: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'flex-start' },
  bookBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  price: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  priceSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
});
