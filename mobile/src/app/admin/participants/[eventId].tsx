import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Share, Text, View } from 'react-native';
import { PaymentEditor } from '@/components/PaymentEditor';
import { Badge, Banner, Body, Button, Card, Chips, Empty, Field, Header, Loading, Screen, useUiStyles } from '@/components/ui';
import { adminCancelReservation, adminCheckIn, adminListParticipants, adminUndoCheckIn, getEvent } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { formatDate, formatPrice, formatTime, paymentLabel } from '@/lib/format';
import type { ParticipantFilter, ParticipantRow } from '@/lib/types';
import { useFocusData } from '@/lib/useAsync';
import { spacing } from '@/theme';

const FILTERS: { value: ParticipantFilter; label: string }[] = [
  { value: 'confirmed', label: 'Confirmés' },
  { value: 'absent', label: 'Pas encore arrivés' },
  { value: 'present', label: 'Présents' },
  { value: 'unpaid', label: 'Non payés' },
  { value: 'paid', label: 'Payés' },
  { value: 'cancelled', label: 'Annulés' },
  { value: 'all', label: 'Tous' },
];

export default function Participants() {
  const styles = useUiStyles();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ParticipantFilter>('confirmed');
  const [openPayment, setOpenPayment] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: event } = useFocusData(() => getEvent(eventId), [eventId]);
  const { data: rows, error, loading, refreshing, refresh } = useFocusData(
    () => adminListParticipants(eventId, search, filter), [eventId, search, filter]);

  async function act(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setActionError(toAppError(e).message);
    }
  }

  // Liste de secours hors réseau : à partager/imprimer avant la sortie.
  async function shareList() {
    const all = await adminListParticipants(eventId, '', 'confirmed');
    const lines = all.map((p) => `☐ ${p.last_name.toUpperCase()} ${p.first_name} — contact ${p.contact_name} ${p.contact_phone ?? ''} — ${paymentLabel[p.payment_status]} (${formatPrice(p.amount_due_cents)})`);
    await Share.share({
      title: `Participants – ${event?.title ?? ''}`,
      message: `${event?.title ?? 'Sortie'} — ${event ? `${formatDate(event.starts_at)} ${formatTime(event.starts_at)}` : ''}\n${all.length} participants\n\n${lines.join('\n')}`,
    });
  }

  // Une réservation regroupe plusieurs participants : le paiement est par réservation.
  const firstOfReservation = new Set<string>();
  const isFirst = (r: ParticipantRow) => {
    if (firstOfReservation.has(r.reservation_id)) return false;
    firstOfReservation.add(r.reservation_id);
    return true;
  };

  return (
    <Screen header={<Header title="Participants" subtitle={event?.title} seed="participants" onBack={() => router.back()} />}
      refreshing={refreshing} onRefresh={refresh}>
      <Field label="Rechercher" icon="search-outline" value={search} onChangeText={setSearch} placeholder="Nom, e-mail ou téléphone"
        autoCapitalize="none" autoCorrect={false} />
      <Chips options={FILTERS} value={filter} onChange={setFilter} />
      <Button variant="secondary" small icon="share-outline" title="Partager la liste (secours hors réseau)" onPress={shareList} />

      {error ? <Banner message={error.message} /> : null}
      {actionError ? <Banner message={actionError} /> : null}
      {loading && !rows ? <Loading /> : null}
      {rows?.length === 0 ? <Empty title="Aucun participant" message="Aucun résultat pour ces critères." /> : null}
      {rows ? <Body muted>{rows.length} participant{rows.length > 1 ? 's' : ''}</Body> : null}

      {rows?.map((p) => {
        const showPayment = isFirst(p) && p.reservation_status === 'confirmed';
        return (
          <Card key={p.attendee_id}>
            <Text style={[styles.sectionTitle, { fontSize: 18 }]}>{p.first_name} {p.last_name}</Text>
            {p.participant_count > 1 ? (
              <Body muted>Groupe de {p.participant_count} • contact : {p.contact_name}</Body>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {p.reservation_status === 'cancelled' ? <Badge label="Annulé" tone="danger" />
                : p.attendance_status === 'present'
                  ? <Badge label={`Présent ${p.checked_in_at ? formatTime(p.checked_in_at) : ''}`} tone="success" />
                  : <Badge label="Attendu" />}
              {p.reservation_status === 'confirmed'
                ? <Badge label={paymentLabel[p.payment_status]} tone={p.payment_status === 'paid' ? 'success' : 'warning'} /> : null}
            </View>
            {p.contact_phone ? (
              <Text style={styles.fieldHint} onPress={() => Linking.openURL(`tel:${p.contact_phone}`)}>
                ☎ {p.contact_phone} · {p.contact_email}
              </Text>
            ) : null}

            {p.reservation_status === 'confirmed' ? (
              p.attendance_status === 'expected'
                ? <Button small icon="checkmark-circle-outline" title="Pointer (saisie manuelle)" onPress={() => act(() => adminCheckIn(p.attendee_id, eventId, 'manual'))} />
                : <Button variant="ghost" small icon="arrow-undo-outline" title="Annuler le pointage" onPress={() => act(() => adminUndoCheckIn(p.attendee_id))} />
            ) : null}

            {showPayment ? (
              openPayment === p.reservation_id ? (
                <PaymentEditor reservationId={p.reservation_id} amountDue={p.amount_due_cents} amountPaid={p.amount_paid_cents}
                  onSaved={() => { setOpenPayment(null); refresh(); }} />
              ) : (
                <Button variant="secondary" small icon="wallet-outline" title={`Paiement : ${formatPrice(p.amount_paid_cents)} / ${formatPrice(p.amount_due_cents)}`}
                  onPress={() => setOpenPayment(p.reservation_id)} />
              )
            ) : null}

            {showPayment ? (
              <Button variant="ghost" small icon="close-circle-outline" title="Annuler la réservation"
                onPress={() => Alert.alert('Annuler cette réservation ?',
                  `${p.participant_count} place(s) seront libérées et le contact sera prévenu par e-mail.`, [
                    { text: 'Non', style: 'cancel' },
                    { text: 'Annuler la réservation', style: 'destructive',
                      onPress: () => act(() => adminCancelReservation(p.reservation_id)) },
                  ])} />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
