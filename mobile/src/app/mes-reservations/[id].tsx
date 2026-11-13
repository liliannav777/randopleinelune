import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoonMark, NightSky } from '@/components/art';
import { QrCard } from '@/components/QrCard';
import {
  Badge,
  Banner,
  Body,
  Button,
  Card,
  Empty,
  Header,
  Icon,
  IconButton,
  InfoRow,
  Loading,
  Screen,
  SectionTitle,
  useUiStyles,
} from '@/components/ui';
import { cancelReservation } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { capitalize, formatDate, formatDateTime, formatPrice, formatTime, paymentLabel } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import { enablePushFor, getPushPermission, type PushPermission } from '@/lib/notifications';
import type { Reservation } from '@/lib/types';
import { fonts, radius, spacing, type Colors } from '@/theme';
import { useColors, useStyles } from '@/lib/theme';

function Hero({ r, isNew, onBack }: { r: Reservation; isNew: boolean; onBack: () => void }) {
  const colors = useColors();
  const s = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const confirmed = r.status === 'confirmed';
  return (
    <View style={[s.hero, { paddingTop: insets.top + spacing.sm }]}>
      <NightSky height={330} seed={r.event.id} moon={{ x: 335, y: 70, r: 18 }} stars={50} />
      <View style={{ alignSelf: 'flex-start' }}><IconButton icon="chevron-back" onPress={onBack} label="Retour" /></View>
      <View style={s.heroCenter}>
        {confirmed ? (
          <View style={s.check}><Icon name="checkmark" size={26} color={colors.primary} /></View>
        ) : (
          <View style={[s.check, { backgroundColor: colors.dangerBg }]}><Icon name="close" size={26} color={colors.danger} /></View>
        )}
        <Text style={s.heroEyebrow}>
          {confirmed ? (isNew ? 'RÉSERVATION CONFIRMÉE' : 'VOTRE RÉSERVATION') : 'RÉSERVATION ANNULÉE'}
        </Text>
        <Text style={s.heroTitle} accessibilityRole="header">{r.event.title}</Text>
        <Text style={s.heroMeta}>{capitalize(formatDate(r.event.starts_at))} · {formatTime(r.event.starts_at)}</Text>
      </View>
    </View>
  );
}

export default function ReservationDetail() {
  const colors = useColors();
  const s = useStyles(makeStyles);
  const styles = useUiStyles();
  const { id, nouvelle } = useLocalSearchParams<{ id: string; nouvelle?: string }>();
  const router = useRouter();
  const { reservations, loading, upsert, tokens } = useMyReservations();
  const r = reservations.find((x) => x.id === id);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [push, setPush] = useState<PushPermission | 'loading'>('loading');

  useEffect(() => { getPushPermission().then(setPush).catch(() => setPush('unavailable')); }, []);

  const goBack = () => (nouvelle ? router.replace('/') : router.back());

  if (!r) {
    return (
      <Screen header={<Header title="Ma réservation" onBack={goBack} />}>
        {loading ? <Loading /> : <Empty title="Réservation introuvable" message="Elle n’est pas enregistrée sur cet appareil." />}
      </Screen>
    );
  }

  const isUpcoming = new Date(r.event.starts_at) > new Date();
  const confirmed = r.status === 'confirmed';

  async function activatePush() {
    try {
      setPush(await enablePushFor(tokens.length ? tokens : [r!.access_token]));
    } catch {
      setPush('unavailable');
    }
  }

  function confirmCancel() {
    Alert.alert(
      'Annuler la réservation ?',
      `Les ${r!.participant_count} place(s) seront libérées et les QR codes ne seront plus valables.`,
      [
        { text: 'Garder ma place', style: 'cancel' },
        {
          text: 'Annuler la réservation', style: 'destructive', onPress: async () => {
            setCancelling(true);
            setError(null);
            try {
              upsert(await cancelReservation(r!.access_token));
            } catch (e) {
              setError(toAppError(e).message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen hero={<Hero r={r} isNew={!!nouvelle} onBack={goBack} />} contentStyle={{ marginTop: -spacing.xxl }}>
      <Card>
        {nouvelle && confirmed ? (
          <Banner tone="success" message="Un e-mail récapitulatif avec vos billets vous a été envoyé." />
        ) : null}
        {!confirmed ? (
          <Banner message={r.cancelled_by === 'event_cancelled'
            ? 'Cette sortie a été annulée par l’organisateur. Aucun paiement n’est dû.'
            : `Réservation annulée${r.cancelled_at ? ` le ${formatDate(r.cancelled_at)}` : ''}.`} />
        ) : null}
        <InfoRow icon="location-outline" label="Rendez-vous" value={r.event.meeting_point} />
        <InfoRow icon="time-outline" label="Heure" value={formatTime(r.event.starts_at)} />
        <InfoRow icon="people-outline" label="Participants" value={String(r.participant_count)} />
        <InfoRow icon="wallet-outline" label="À régler sur place" value={formatPrice(r.total_amount_cents)} />
        {confirmed ? (
          <View style={styles.infoRow}>
            <View style={styles.infoLabelWrap}>
              <Icon name="card-outline" size={16} color={colors.textFaint} />
              <Text style={styles.infoLabel}>Paiement</Text>
            </View>
            <Badge label={paymentLabel[r.payment.status]} tone={r.payment.status === 'paid' ? 'success' : 'accent'} />
          </View>
        ) : null}
        {r.event.meeting_point_url && confirmed ? (
          <Button variant="secondary" small icon="navigate-outline" title="Itinéraire vers le rendez-vous"
            onPress={() => Linking.openURL(r.event.meeting_point_url!)} style={{ marginTop: spacing.sm }} />
        ) : null}
      </Card>

      {confirmed ? (
        <>
          <SectionTitle>{r.attendees.length > 1 ? 'Vos billets' : 'Votre billet'}</SectionTitle>
          {r.attendees.map((a) => (
            <QrCard key={a.id} attendee={a} total={r.attendees.length} eventTitle={r.event.title} startsAt={r.event.starts_at} />
          ))}
        </>
      ) : null}

      {confirmed && isUpcoming && push !== 'granted' && push !== 'unavailable' && push !== 'loading' ? (
        <View style={s.pushCard}>
          <NightSky height={180} seed="rappels" moon={{ x: 350, y: 40, r: 14 }} hills={false} stars={30} />
          <MoonMark size={36} />
          <Text style={s.pushTitle}>Ne manquez pas le lever de lune</Text>
          <Text style={s.pushText}>
            Un rappel la veille et quelques heures avant le départ, et une alerte si la sortie change.
            La confirmation par e-mail reste votre justificatif.
          </Text>
          {push === 'denied'
            ? <Button variant="gold" small icon="settings-outline" title="Ouvrir les réglages" onPress={() => Linking.openSettings()} />
            : <Button variant="gold" small icon="notifications-outline" title="Activer les rappels" onPress={activatePush} />}
        </View>
      ) : null}
      {push === 'granted' && confirmed && isUpcoming ? <Badge label="Rappels activés" tone="success" icon="notifications" /> : null}

      {r.event.equipment && confirmed ? (<><SectionTitle>Équipement conseillé</SectionTitle><Body>{r.event.equipment}</Body></>) : null}
      {r.event.instructions && confirmed ? (<><SectionTitle>Consignes</SectionTitle><Body>{r.event.instructions}</Body></>) : null}

      {error ? <Banner message={error} /> : null}
      {r.can_cancel ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
          <Button variant="danger" icon="close-circle-outline" title="Annuler ma réservation" onPress={confirmCancel} loading={cancelling} />
          <Text style={[styles.fieldHint, { textAlign: 'center' }]}>
            Annulation possible jusqu’au {formatDateTime(r.cancellation_deadline)}.
          </Text>
        </View>
      ) : confirmed && isUpcoming ? (
        <Body muted style={{ fontSize: 13 }}>Le délai d’annulation en ligne est dépassé : contactez l’organisateur en cas d’empêchement.</Body>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl + spacing.xl, overflow: 'hidden', backgroundColor: colors.primary,
  },
  heroCenter: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  check: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  heroEyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.8, color: colors.accentLight, marginTop: spacing.xs },
  heroTitle: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, color: colors.onPrimary, textAlign: 'center' },
  heroMeta: { fontFamily: fonts.medium, fontSize: 14, color: colors.onPrimaryMuted },
  pushCard: {
    borderRadius: radius.lg, overflow: 'hidden', padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.primary,
    alignItems: 'flex-start',
  },
  pushTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.onPrimary },
  pushText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.onPrimaryMuted, marginBottom: spacing.xs },
});
