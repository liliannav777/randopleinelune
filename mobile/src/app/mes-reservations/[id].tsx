import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Text } from 'react-native';
import { QrCard } from '@/components/QrCard';
import { Badge, Banner, Body, Button, Card, Empty, Header, InfoRow, Loading, Screen, SectionTitle, styles } from '@/components/ui';
import { cancelReservation } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { capitalize, formatDate, formatDateTime, formatPrice, formatTime, paymentLabel } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import { enablePushFor, getPushPermission, type PushPermission } from '@/lib/notifications';

export default function ReservationDetail() {
  const { id, nouvelle } = useLocalSearchParams<{ id: string; nouvelle?: string }>();
  const router = useRouter();
  const { reservations, loading, upsert, tokens } = useMyReservations();
  const r = reservations.find((x) => x.id === id);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [push, setPush] = useState<PushPermission | 'loading'>('loading');

  useEffect(() => { getPushPermission().then(setPush).catch(() => setPush('unavailable')); }, []);

  const header = <Header title="Ma réservation" subtitle={nouvelle ? 'Confirmation' : undefined}
    onBack={() => (nouvelle ? router.replace('/') : router.back())} />;

  if (!r) {
    return (
      <Screen header={header}>
        {loading ? <Loading /> : <Empty title="Réservation introuvable" message="Elle n'est pas enregistrée sur cet appareil." />}
      </Screen>
    );
  }

  const isUpcoming = new Date(r.event.starts_at) > new Date();

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
    <Screen header={header}>
      {r.status === 'confirmed' ? (
        <Banner tone="success" message={nouvelle ? 'Réservation confirmée ! Un e-mail récapitulatif vous a été envoyé.' : 'Réservation confirmée'} />
      ) : (
        <Banner message={r.cancelled_by === 'event_cancelled'
          ? 'Cette sortie a été annulée par l\'organisateur. Aucun paiement n\'est dû.'
          : `Réservation annulée${r.cancelled_at ? ` le ${formatDate(r.cancelled_at)}` : ''}.`} />
      )}

      <Card>
        <Text style={[styles.body, { fontWeight: '700' }]}>{r.event.title}</Text>
        <InfoRow label="Date" value={capitalize(formatDate(r.event.starts_at))} />
        <InfoRow label="Heure du rendez-vous" value={formatTime(r.event.starts_at)} />
        <InfoRow label="Lieu" value={r.event.meeting_point} />
        <InfoRow label="Participants" value={String(r.participant_count)} />
        <InfoRow label="Total à régler sur place" value={formatPrice(r.total_amount_cents)} />
        {r.status === 'confirmed' ? <InfoRow label="Paiement" value={paymentLabel[r.payment.status]} /> : null}
      </Card>

      {r.event.meeting_point_url && r.status === 'confirmed' ? (
        <Button variant="secondary" title="Itinéraire vers le rendez-vous" onPress={() => Linking.openURL(r.event.meeting_point_url!)} />
      ) : null}

      {r.status === 'confirmed' ? (
        <>
          <SectionTitle>QR code{r.attendees.length > 1 ? 's' : ''}</SectionTitle>
          <Body muted>Présentez ce QR code à l’organisateur. Paiement sur place.</Body>
          {r.attendees.map((a) => <QrCard key={a.id} attendee={a} total={r.attendees.length} />)}
        </>
      ) : null}

      {r.status === 'confirmed' && isUpcoming && push !== 'granted' && push !== 'unavailable' && push !== 'loading' ? (
        <Card>
          <Text style={[styles.body, { fontWeight: '700' }]}>Recevoir les rappels ?</Text>
          <Body muted>
            Une notification la veille et quelques heures avant le départ, et une alerte si la sortie est modifiée ou annulée.
            Vous recevez de toute façon la confirmation par e-mail.
          </Body>
          {push === 'denied'
            ? <Button variant="secondary" title="Ouvrir les réglages" onPress={() => Linking.openSettings()} />
            : <Button variant="secondary" title="Activer les rappels" onPress={activatePush} />}
        </Card>
      ) : null}
      {push === 'granted' && r.status === 'confirmed' && isUpcoming ? <Badge label="Rappels activés" tone="success" /> : null}

      {r.event.equipment && r.status === 'confirmed' ? (<><SectionTitle>Équipement conseillé</SectionTitle><Body>{r.event.equipment}</Body></>) : null}
      {r.event.instructions && r.status === 'confirmed' ? (<><SectionTitle>Consignes</SectionTitle><Body>{r.event.instructions}</Body></>) : null}

      {error ? <Banner message={error} /> : null}
      {r.can_cancel ? (
        <>
          <Button variant="secondary" title="Annuler ma réservation" onPress={confirmCancel} loading={cancelling} />
          <Text style={[styles.fieldHint, { textAlign: 'center' }]}>
            Annulation possible jusqu’au {formatDateTime(r.cancellation_deadline)}.
          </Text>
        </>
      ) : r.status === 'confirmed' && isUpcoming ? (
        <Body muted>Le délai d’annulation en ligne est dépassé : contactez l’organisateur en cas d’empêchement.</Body>
      ) : null}
    </Screen>
  );
}
