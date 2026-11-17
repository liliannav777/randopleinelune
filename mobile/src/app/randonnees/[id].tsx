import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EventCover, eventStatusBadge, factsLine, SeatsMeter } from '@/components/EventCard';
import {
  Banner, Body, Button, Divider, Empty, Header, IconButton, InfoRow, LinkText, Loading, Screen, SectionTitle,
} from '@/components/ui';
import { getEvent } from '@/lib/api';
import { capitalize, formatDate, formatPrice, formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import type { HikeEvent } from '@/lib/types';
import { useLightStatusBar, useStyles } from '@/lib/theme';
import { useFocusData } from '@/lib/useAsync';
import { fonts, spacing, type Colors } from '@/theme';

function Hero({ event, onBack }: { event: HikeEvent; onBack: () => void }) {
  const s = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <EventCover uri={event.cover_image} height={260 + insets.top} seed={event.id} hint={`${event.title} ${event.meeting_point}`} rounded={false}>
      <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} locations={[0, 0.4]} style={StyleSheet.absoluteFill} />
      <View style={[s.back, { top: insets.top + spacing.sm }]}>
        <IconButton icon="chevron-back" onPress={onBack} label="Retour" />
      </View>
    </EventCover>
  );
}

export default function HikeDetail() {
  useLightStatusBar();
  const s = useStyles(makeStyles);
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
  const facts = factsLine(event);

  let footer;
  if (mine) {
    footer = <Button variant="gold" title="Voir mon billet" onPress={() => router.push(`/mes-reservations/${mine.id}`)} />;
  } else if (canBook) {
    footer = (
      <View style={s.bookBar}>
        <View>
          <Text style={s.price}>{event.price_cents ? formatPrice(event.price_cents) : 'Gratuit'}</Text>
          <Text style={s.priceSub}>{event.price_cents ? 'par personne, à régler sur place' : 'sur réservation'}</Text>
        </View>
        <Button variant="gold" title="Réserver" onPress={() => router.push(`/reserver/${event.id}`)} style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <Screen hero={<Hero event={event} onBack={() => router.back()} />} footer={footer} refreshing={refreshing} onRefresh={refresh}>
      {eventStatusBadge(event)}
      <Text style={s.title} accessibilityRole="header">{event.title}</Text>
      <Text style={s.when}>{capitalize(formatDate(event.starts_at))}, départ à {formatTime(event.starts_at)}</Text>
      {facts ? <Text style={s.facts}>{facts}</Text> : null}

      {event.status === 'cancelled' ? <Banner title="Sortie annulée" message="Cette sortie n’aura pas lieu." /> : null}
      {open && full && !mine ? (
        <Banner tone="warning" title="C’est complet" message="Il n’y a pas de liste d’attente pour l’instant. D’autres dates arrivent bientôt." />
      ) : null}
      {mine ? <Banner tone="success" message="Vous êtes inscrit à cette sortie. Votre billet est dans « Mes billets »." /> : null}

      {open && !full ? <View style={{ marginTop: spacing.sm }}><SeatsMeter event={event} /></View> : null}

      {event.summary ? <Body style={s.lead}>{event.summary}</Body> : null}

      <SectionTitle>Rendez-vous</SectionTitle>
      <View>
        <InfoRow label="Lieu" value={event.meeting_point} />
        <Divider />
        <InfoRow label="Heure" value={formatTime(event.starts_at)} />
        {event.ends_at ? <><Divider /><InfoRow label="Retour prévu vers" value={formatTime(event.ends_at)} /></> : null}
      </View>
      {event.meeting_point_url ? (
        <LinkText onPress={() => Linking.openURL(event.meeting_point_url!)}>Ouvrir l’itinéraire dans Plans</LinkText>
      ) : null}

      {event.description ? (<><SectionTitle>La balade</SectionTitle><Body>{event.description}</Body></>) : null}
      {event.equipment ? (<><SectionTitle>À emporter</SectionTitle><Body>{event.equipment}</Body></>) : null}
      {event.instructions ? (<><SectionTitle>Bon à savoir</SectionTitle><Body>{event.instructions}</Body></>) : null}

      <Body muted style={s.note}>
        Le paiement se fait sur place, le jour de la sortie.{' '}
        {event.cancellation_deadline_hours != null
          ? `Vous pouvez annuler depuis l’application jusqu’à ${event.cancellation_deadline_hours} h avant le départ.`
          : 'Vous pouvez annuler depuis l’application, dans le délai fixé par l’organisateur.'}
      </Body>
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  back: { position: 'absolute', left: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.text, marginTop: spacing.xs },
  when: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  facts: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  lead: { fontSize: 17, lineHeight: 26, marginTop: spacing.sm },
  note: { fontSize: 14, lineHeight: 20, marginTop: spacing.lg },
  bookBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  price: { fontFamily: fonts.semibold, fontSize: 20, color: colors.text },
  priceSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
});
