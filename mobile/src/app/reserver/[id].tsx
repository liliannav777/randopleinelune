import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { EventCover } from '@/components/EventCard';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  Header,
  Icon,
  LinkText,
  Loading,
  Screen,
  SectionTitle,
  Stepper,
  useUiStyles,
} from '@/components/ui';
import { createReservation, getEvent, getSettings } from '@/lib/api';
import { newUuid } from '@/lib/ids';
import { toAppError } from '@/lib/errors';
import { capitalize, formatDate, formatPrice, formatTariff, formatTime } from '@/lib/format';
import { useMyReservations } from '@/lib/myReservations';
import { useFocusData } from '@/lib/useAsync';
import { attendeesPayload, validateReservation, type FormErrors, type ReservationForm } from '@/lib/validation';
import { fonts, spacing } from '@/theme';
import { useColors } from '@/lib/theme';

export default function Reserve() {
  const colors = useColors();
  const styles = useUiStyles();
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

  const header = <Header title="Réserver" subtitle="Votre inscription" onBack={() => router.back()} seed="reserver" />;
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={styles.infoLabel}>Total à régler sur place</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: colors.text }}>{formatPrice(total)}</Text>
            </View>
            <Button variant="gold" icon="checkmark-circle-outline" title="Confirmer la réservation" onPress={submit}
              loading={submitting} disabled={seatsLeft === 0} />
            <Text style={[styles.fieldHint, { textAlign: 'center' }]}>Confirmation immédiate si places disponibles</Text>
          </>
        )}
      >
        <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View style={{ width: 64 }}><EventCover uri={event.cover_image} height={64} seed={event.id} hint={`${event.title} ${event.meeting_point}`} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.text }} numberOfLines={2}>{event.title}</Text>
            <Text style={styles.fieldHint}>{capitalize(formatDate(event.starts_at))} · {formatTime(event.starts_at)}</Text>
            <Text style={styles.fieldHint} numberOfLines={1}>{event.meeting_point} · {formatTariff(event.price_cents)}</Text>
          </View>
        </Card>

        <SectionTitle>Contact principal</SectionTitle>
        <Field label="Prénom" icon="person-outline" value={form.firstName} onChangeText={(v) => set('firstName', v)} error={errors.firstName}
          autoComplete="given-name" textContentType="givenName" maxLength={80} />
        <Field label="Nom" icon="person-outline" value={form.lastName} onChangeText={(v) => set('lastName', v)} error={errors.lastName}
          autoComplete="family-name" textContentType="familyName" maxLength={80} />
        <Field label="Adresse e-mail" icon="mail-outline" value={form.email} onChangeText={(v) => set('email', v)} error={errors.email}
          keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
          hint="La confirmation et les QR codes y seront envoyés." />
        <Field label="Téléphone" icon="call-outline" value={form.phone} onChangeText={(v) => set('phone', v)} error={errors.phone}
          keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber"
          hint="Utile à l’organisateur le jour de la sortie." />

        <SectionTitle>Participants</SectionTitle>
        <Stepper label="Nombre de participants" value={form.participantCount} min={1} max={maxCount}
          onChange={(v) => set('participantCount', v)} />
        {errors.participantCount ? <Text style={styles.fieldError}>{errors.participantCount}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="qr-code-outline" size={14} color={colors.textMuted} />
          <Text style={styles.fieldHint}>
            {seatsLeft} place{seatsLeft > 1 ? 's' : ''} restante{seatsLeft > 1 ? 's' : ''} · un billet QR par participant
          </Text>
        </View>

        {form.participantCount > 1 ? (
          <View style={{ gap: spacing.sm }}>
            <Pressable onPress={() => setShowNames((s) => !s)} accessibilityRole="button" hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 }}>
              <Icon name={showNames ? 'remove-circle-outline' : 'add-circle-outline'} size={18} color={colors.link} />
              <Text style={{ color: colors.link, fontFamily: fonts.medium, fontSize: 14 }}>
                {showNames ? 'Masquer' : 'Indiquer'} le nom des accompagnants (facultatif)
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

        <SectionTitle>Conditions</SectionTitle>
        <Checkbox checked={form.acceptTerms} onChange={(v) => set('acceptTerms', v)}
          label="J'accepte les conditions de participation (paiement sur place, consignes de sécurité, conditions d'annulation)." />
        <Checkbox checked={form.acceptPrivacy} onChange={(v) => set('acceptPrivacy', v)}
          label="J'ai lu la politique de confidentialité : mes coordonnées servent uniquement à l'organisation de la sortie." />
        <LinkText icon="document-text-outline" onPress={() => router.push('/confidentialite')}>
          Lire les conditions et la politique de confidentialité
        </LinkText>
        {errors.consent ? <Text style={styles.fieldError}>{errors.consent}</Text> : null}

        {serverError ? <Banner message={serverError} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
