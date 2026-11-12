import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { PaymentEditor } from '@/components/PaymentEditor';
import { Banner, Body, Button, Card, Header, Icon, InfoRow, Screen, styles, type IconName } from '@/components/ui';
import { adminCheckIn, adminLookupQr, getEvent } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { formatPrice, formatTime, paymentLabel } from '@/lib/format';
import type { AttendeeAdminInfo, ScanResult } from '@/lib/types';
import { useFocusData } from '@/lib/useAsync';
import { colors, fonts, radius, spacing } from '@/theme';

const RESULT: Record<ScanResult, { label: string; tone: 'success' | 'warning' | 'danger'; icon: IconName }> = {
  valid: { label: 'Réservation valide', tone: 'success', icon: 'checkmark-circle' },
  checked_in: { label: 'Présence confirmée', tone: 'success', icon: 'checkmark-done-circle' },
  already_present: { label: 'Déjà présent', tone: 'warning', icon: 'alert-circle' },
  cancelled: { label: 'Réservation annulée', tone: 'danger', icon: 'close-circle' },
  wrong_event: { label: 'QR code d’une autre sortie', tone: 'danger', icon: 'swap-horizontal' },
  unknown: { label: 'QR code invalide', tone: 'danger', icon: 'help-circle' },
};
const TONE = {
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
};

export default function Scanner() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const { data: event } = useFocusData(() => getEvent(eventId), [eventId]);
  const [info, setInfo] = useState<AttendeeAdminInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const locked = useRef(false);
  const lastToken = useRef<string | null>(null);

  const onScanned = useCallback(async ({ data }: BarcodeScanningResult) => {
    // Un seul scan traité à la fois ; la caméra est mise en pause jusqu'au « scan suivant ».
    if (locked.current) return;
    locked.current = true;
    setError(null);
    setBusy(true);
    try {
      if (!data.startsWith('RPL1.')) {
        setInfo({ result: 'unknown' });
      } else {
        lastToken.current = data;
        setInfo(await adminLookupQr(data, eventId));
      }
    } catch (e) {
      setError(toAppError(e).message);
      locked.current = false;
    } finally {
      setBusy(false);
    }
  }, [eventId]);

  async function confirmPresence() {
    if (!info?.attendee) return;
    setBusy(true);
    setError(null);
    try {
      setInfo(await adminCheckIn(info.attendee.id, eventId, 'qr'));
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setInfo(null);
    setError(null);
    setShowPayment(false);
    lastToken.current = null;
    locked.current = false;
  }

  async function refreshInfo() {
    if (!lastToken.current || !info) return;
    // Relecture seule (aucun pointage) pour afficher le paiement à jour.
    const r = await adminLookupQr(lastToken.current, eventId).catch(() => null);
    if (r) setInfo({ ...r, result: info.result === 'checked_in' ? 'checked_in' : r.result });
  }

  const header = <Header seed="pointage" title="Pointage" subtitle={event ? `${event.title} • ${formatTime(event.starts_at)}` : 'Scanner une réservation'}
    onBack={() => router.back()} />;

  let camera;
  if (!permission) {
    camera = <View style={s.camera} />;
  } else if (!permission.granted) {
    camera = (
      <Card>
        <Body>La caméra est nécessaire pour scanner les QR codes des participants.</Body>
        {permission.canAskAgain
          ? <Button title="Autoriser la caméra" onPress={requestPermission} />
          : <Button title="Ouvrir les réglages" onPress={() => Linking.openSettings()} />}
      </Card>
    );
  } else {
    camera = (
      <View style={s.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={info || busy ? undefined : onScanned}
        />
        <View style={s.frame} pointerEvents="none">
          <View style={[s.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 }]} />
          <View style={[s.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 }]} />
          <View style={[s.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 }]} />
          <View style={[s.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 }]} />
        </View>
      </View>
    );
  }

  const r = info ? RESULT[info.result] : null;

  return (
    <Screen header={header}>
      {camera}
      <Body muted>Scanner le QR code du participant</Body>
      {error ? <Banner message={error} /> : null}

      {info && r ? (
        <Card style={{ borderTopWidth: 5, borderTopColor: TONE[r.tone].fg }}>
          <View style={[s.result, { backgroundColor: TONE[r.tone].bg }]}>
            <Icon name={r.icon} size={30} color={TONE[r.tone].fg} />
            <Text style={[s.resultText, { color: TONE[r.tone].fg }]}>{r.label}</Text>
          </View>
          {info.attendee ? (
            <>
              <Text style={[styles.title, { fontSize: 20 }]}>{info.attendee.first_name} {info.attendee.last_name}</Text>
              {info.reservation && info.reservation.participant_count > 1 ? (
                <Body muted>
                  Groupe de {info.reservation.participant_count} • contact : {info.reservation.contact.first_name}{' '}
                  {info.reservation.contact.last_name}
                </Body>
              ) : null}
              {info.result === 'wrong_event' && info.event ? <Body muted>Réservation pour : {info.event.title}</Body> : null}
              {info.attendee.checked_in_at ? <InfoRow label="Pointé à" value={formatTime(info.attendee.checked_in_at)} /> : null}
              {info.payment && info.result !== 'cancelled' ? (
                <InfoRow label="Paiement" value={`${paymentLabel[info.payment.status]} (${formatPrice(info.payment.amount_paid_cents)} / ${formatPrice(info.payment.amount_due_cents)})`} />
              ) : null}
              <Body muted>En cas de doute, vérifiez le nom du participant : le QR code n’est pas une pièce d’identité.</Body>
            </>
          ) : null}

          {info.result === 'valid' ? <Button variant="gold" icon="checkmark-circle-outline" title="Confirmer la présence" loading={busy} onPress={confirmPresence} /> : null}
          {info.reservation && info.payment && info.payment.status !== 'paid'
            && (info.result === 'checked_in' || info.result === 'already_present' || info.result === 'valid') ? (
              showPayment
                ? <PaymentEditor reservationId={info.reservation.id} amountDue={info.payment.amount_due_cents}
                    amountPaid={info.payment.amount_paid_cents} onSaved={() => { setShowPayment(false); refreshInfo(); }} />
                : <Button variant="secondary" icon="wallet-outline" title="Marquer comme payé" onPress={() => setShowPayment(true)} />
            ) : null}
          <Button icon="scan-outline" title="Scanner le suivant" onPress={next} />
        </Card>
      ) : null}

      <Button variant="ghost" icon="list-outline" title="Saisie manuelle (liste des participants)" onPress={() => router.push(`/admin/participants/${eventId}`)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  camera: { height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.primary },
  frame: { position: 'absolute', top: 50, bottom: 50, left: '22%', right: '22%' },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.accent },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, padding: spacing.md },
  resultText: { fontFamily: fonts.semibold, fontSize: 17, flex: 1 },
});
