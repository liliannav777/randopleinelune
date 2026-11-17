import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { QrCard } from '@/components/QrCard';
import {
  Badge, Banner, Body, Button, Card, Divider, Empty, Header, InfoRow, LinkText, Loading, Screen, SectionTitle, useUiStyles,
} from '@/components/ui';
import { cancelReservation } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { capitalize, formatDate, formatDateTime, formatPrice, formatTime, paymentLabel } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import { enablePushFor, getPushPermission, type PushPermission } from '@/lib/notifications';
import { fonts, spacing, type Colors } from '@/theme';
import { useStyles } from '@/lib/theme';

export default function ReservationDetail() {
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

  const title = !confirmed ? 'Réservation annulée' : nouvelle ? 'C’est réservé !' : 'Votre réservation';

  return (
    <Screen header={<Header title={title} onBack={goBack} />}>
      {nouvelle && confirmed ? (
        <Banner tone="success" message="Vous allez recevoir un e-mail avec le récapitulatif et vos billets." />
      ) : null}
      {!confirmed ? (
        <Banner message={r.cancelled_by === 'event_cancelled'
          ? 'Cette sortie a été annulée par l’organisateur. Vous n’avez rien à régler.'
          : `Vous avez annulé cette réservation${r.cancelled_at ? ` le ${formatDate(r.cancelled_at)}` : ''}.`} />
      ) : null}

      <Text style={s.event}>{r.event.title}</Text>
      <Text style={s.when}>{capitalize(formatDate(r.event.starts_at))}, rendez-vous à {formatTime(r.event.starts_at)}</Text>

      <View style={{ marginTop: spacing.sm }}>
        <InfoRow label="Lieu" value={r.event.meeting_point} />
        <Divider />
        <InfoRow label="Participants" value={String(r.participant_count)} />
        <Divider />
        <InfoRow label="À régler sur place" value={formatPrice(r.total_amount_cents)} />
        {confirmed ? (
          <>
            <Divider />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Paiement</Text>
              <Badge label={paymentLabel[r.payment.status]} tone={r.payment.status === 'paid' ? 'success' : 'neutral'} />
            </View>
          </>
        ) : null}
      </View>
      {r.event.meeting_point_url && confirmed ? (
        <LinkText onPress={() => Linking.openURL(r.event.meeting_point_url!)}>Ouvrir l’itinéraire dans Plans</LinkText>
      ) : null}

      {confirmed ? (
        <>
          <SectionTitle>{r.attendees.length > 1 ? 'Vos billets' : 'Votre billet'}</SectionTitle>
          <Body muted style={{ fontSize: 14 }}>Montrez-le à l’organisateur au départ. Une capture d’écran fonctionne aussi.</Body>
          {r.attendees.map((a) => (
            <QrCard key={a.id} attendee={a} total={r.attendees.length} eventTitle={r.event.title} startsAt={r.event.starts_at} />
          ))}
        </>
      ) : null}

      {confirmed && isUpcoming && push !== 'granted' && push !== 'unavailable' && push !== 'loading' ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={s.pushTitle}>Recevoir un rappel ?</Text>
          <Body muted style={{ fontSize: 14, lineHeight: 20 }}>
            Une notification la veille et quelques heures avant le départ, et un message si la sortie change.
            L’e-mail de confirmation reste votre justificatif.
          </Body>
          {push === 'denied'
            ? <Button variant="secondary" small title="Ouvrir les réglages" onPress={() => Linking.openSettings()} />
            : <Button variant="secondary" small title="Activer les rappels" onPress={activatePush} />}
        </Card>
      ) : null}
      {push === 'granted' && confirmed && isUpcoming ? <Body muted style={{ fontSize: 14 }}>Les rappels sont activés.</Body> : null}

      {r.event.equipment && confirmed ? (<><SectionTitle>À emporter</SectionTitle><Body>{r.event.equipment}</Body></>) : null}
      {r.event.instructions && confirmed ? (<><SectionTitle>Bon à savoir</SectionTitle><Body>{r.event.instructions}</Body></>) : null}

      {error ? <Banner message={error} /> : null}
      {r.can_cancel ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.lg }}>
          <Button variant="ghost" title="Annuler ma réservation" onPress={confirmCancel} loading={cancelling} />
          <Text style={[styles.fieldHint, { textAlign: 'center' }]}>
            Possible jusqu’au {formatDateTime(r.cancellation_deadline)}.
          </Text>
        </View>
      ) : confirmed && isUpcoming ? (
        <Body muted style={{ fontSize: 14 }}>Le délai pour annuler en ligne est passé : en cas d’empêchement, prévenez l’organisateur.</Body>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  event: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text, marginTop: spacing.xs },
  when: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
  pushTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
});
