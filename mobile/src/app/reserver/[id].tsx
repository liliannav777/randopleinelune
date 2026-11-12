import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import {
  Banner, Body, Button, Card, Checkbox, Field, Header, InfoRow, Loading, Screen, SectionTitle, Stepper, styles,
} from '@/components/ui';
import { createReservation, getEvent, getSettings } from '@/lib/api';
import { newUuid } from '@/lib/ids';
import { toAppError } from '@/lib/errors';
import { capitalize, formatDate, formatPrice, formatTariff, formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import { useFocusData } from '@/lib/useAsync';
import { attendeesPayload, validateReservation, type FormErrors, type ReservationForm } from '@/lib/validation';
import { colors, spacing } from '@/theme';

export default function Reserve() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToken, upsert } = useMyReservations();
  const { data, error: loadError, loading } = useFocusData(
    () => Promise.all([getEvent(id), getSettings()]), [id]);

  // Clé d'idempotence générée une fois par formulaire : un double appui ou une
  // nouvelle tentative après coupure réseau ne crée jamais deux réservations.
  const [initialKey] = useState(newUuid);
  const idempotencyKey = useRef(initialKey);

  const [form, setForm] = useState<ReservationForm>({
    firstName: '', lastName: '', email: '', phone: '', participantCount: 1, companions: [],
    acceptTerms: false, acceptPrivacy: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showNames, setShowNames] = useState(false);

  const header = <Header title="Réserver" subtitle="Détails de votre inscription" onBack={() => router.back()} />;
  const [event, settings] = data ?? [null, null];
  if (loading && !data) return <Screen header={header}><Loading /></Screen>;
  if (!event || !settings) {
    return <Screen header={header}><Banner message={loadError?.message ?? "Cette sortie n'est plus disponible."} /></Screen>;
  }

  const seatsLeft = Math.max(0, event.capacity - event.seats_taken);
  const maxCount = Math.max(1, Math.min(settings.max_participants_per_reservation, seatsLeft));
  const total = event.price_cents * form.participantCount;
  const set = <K extends keyof ReservationForm>(k: K, v: ReservationForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (submitting) return;
    const errs = validateReservation(form, { maxPerReservation: settings!.max_participants_per_reservation, seatsLeft });
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const reservation = await createReservation({
        eventId: event!.id,
        idempotencyKey: idempotencyKey.current,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        participantCount: form.participantCount,
        attendees: attendeesPayload(form),
        acceptTerms: form.acceptTerms,
        acceptPrivacy: form.acceptPrivacy,
      });
      upsert(reservation);
      await addToken(reservation.access_token);
      router.replace({ pathname: '/mes-reservations/[id]', params: { id: reservation.id, nouvelle: '1' } });
    } catch (e) {
      const err = toAppError(e);
      setServerError(err.message);
      // Erreur métier définitive : une nouvelle tentative doit être une nouvelle demande.
      if (err.code !== 'NETWORK' && err.code !== 'UNKNOWN') idempotencyKey.current = newUuid();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={header}
        footer={(
          <>
            <Button title="Confirmer la réservation" onPress={submit} loading={submitting} disabled={seatsLeft === 0} />
            <Text style={[styles.fieldHint, { textAlign: 'center' }]}>Confirmation immédiate si places disponibles</Text>
          </>
        )}
      >
        <Card>
          <Text style={[styles.body, { fontWeight: '700' }]}>{event.title}</Text>
          <Body muted>{capitalize(formatDate(event.starts_at))} • {formatTime(event.starts_at)} • {event.meeting_point}</Body>
        </Card>

        <SectionTitle>Contact principal</SectionTitle>
        <Field label="Prénom" value={form.firstName} onChangeText={(v) => set('firstName', v)} error={errors.firstName}
          autoComplete="given-name" textContentType="givenName" maxLength={80} />
        <Field label="Nom" value={form.lastName} onChangeText={(v) => set('lastName', v)} error={errors.lastName}
          autoComplete="family-name" textContentType="familyName" maxLength={80} />
        <Field label="Adresse e-mail" value={form.email} onChangeText={(v) => set('email', v)} error={errors.email}
          keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
          hint="La confirmation et les QR codes y seront envoyés." />
        <Field label="Téléphone" value={form.phone} onChangeText={(v) => set('phone', v)} error={errors.phone}
          keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber"
          hint="Utile à l'organisateur le jour de la sortie." />

        <Stepper label="Nombre de participants" value={form.participantCount} min={1} max={maxCount}
          onChange={(v) => set('participantCount', v)} />
        {errors.participantCount ? <Text style={styles.fieldError}>{errors.participantCount}</Text> : null}
        <Text style={styles.fieldHint}>
          {seatsLeft} place{seatsLeft > 1 ? 's' : ''} restante{seatsLeft > 1 ? 's' : ''} • un QR code par participant
        </Text>

        {form.participantCount > 1 ? (
          <View style={{ gap: spacing.sm }}>
            <Pressable onPress={() => setShowNames((s) => !s)} accessibilityRole="button" hitSlop={8}>
              <Text style={{ color: colors.secondary, fontWeight: '600' }}>
                {showNames ? '− Masquer' : '+ Indiquer'} le nom des accompagnants (facultatif)
              </Text>
            </Pressable>
            {showNames ? Array.from({ length: form.participantCount - 1 }, (_, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Field label={`Prénom (participant ${i + 2})`} value={form.companions[i]?.firstName ?? ''}
                    onChangeText={(v) => setForm((f) => {
                      const c = [...f.companions];
                      c[i] = { firstName: v, lastName: c[i]?.lastName ?? '' };
                      return { ...f, companions: c };
                    })} maxLength={80} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Nom" value={form.companions[i]?.lastName ?? ''}
                    onChangeText={(v) => setForm((f) => {
                      const c = [...f.companions];
                      c[i] = { firstName: c[i]?.firstName ?? '', lastName: v };
                      return { ...f, companions: c };
                    })} maxLength={80} />
                </View>
              </View>
            )) : null}
          </View>
        ) : null}

        <Card>
          <InfoRow label="Tarif" value={formatTariff(event.price_cents)} />
          <InfoRow label="Total à régler sur place" value={formatPrice(total)} />
        </Card>

        <Checkbox checked={form.acceptTerms} onChange={(v) => set('acceptTerms', v)}
          label="J'accepte les conditions de participation (paiement sur place, consignes de sécurité, conditions d'annulation)." />
        <Checkbox checked={form.acceptPrivacy} onChange={(v) => set('acceptPrivacy', v)}
          label="J'ai lu la politique de confidentialité : mes coordonnées servent uniquement à l'organisation de la sortie." />
        <Pressable onPress={() => router.push('/confidentialite')} accessibilityRole="link" hitSlop={8}>
          <Text style={{ color: colors.secondary, textDecorationLine: 'underline' }}>Lire les conditions et la politique de confidentialité</Text>
        </Pressable>
        {errors.consent ? <Text style={styles.fieldError}>{errors.consent}</Text> : null}

        {serverError ? <Banner message={serverError} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
