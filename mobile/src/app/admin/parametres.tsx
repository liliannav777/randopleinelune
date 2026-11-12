import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Banner, Body, Button, Field, Header, Loading, Screen, SectionTitle } from '@/components/ui';
import { adminUpdateSettings, getSettings } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import type { AppSettings } from '@/lib/types';
import { EMAIL_RE } from '@/lib/validation';

type Form = Record<'organizer_name' | 'organizer_email' | 'organizer_phone' | 'default_capacity'
  | 'default_cancellation_deadline_hours' | 'max_participants_per_reservation' | 'reminders' | 'data_retention_months', string>;

function toForm(s: AppSettings): Form {
  return {
    organizer_name: s.organizer_name, organizer_email: s.organizer_email ?? '', organizer_phone: s.organizer_phone ?? '',
    default_capacity: String(s.default_capacity),
    default_cancellation_deadline_hours: String(s.default_cancellation_deadline_hours),
    max_participants_per_reservation: String(s.max_participants_per_reservation),
    reminders: s.reminder_offsets_hours.join(', '),
    data_retention_months: String(s.data_retention_months),
  };
}

export default function Settings() {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'danger' | 'success' } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then((s) => setForm(toForm(s))).catch((e) => setMessage({ text: toAppError(e).message, tone: 'danger' }));
  }, []);

  const header = <Header title="Paramètres" subtitle="Organisateur, rappels, annulation" onBack={() => router.back()} />;
  if (!form) return <Screen header={header}>{message ? <Banner message={message.text} /> : <Loading />}</Screen>;
  const set = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save() {
    const int = (s: string) => (/^\d+$/.test(s.trim()) ? parseInt(s, 10) : NaN);
    const reminders = form!.reminders.split(/[,\s]+/).filter(Boolean).map(int);
    const values = {
      default_capacity: int(form!.default_capacity),
      default_cancellation_deadline_hours: int(form!.default_cancellation_deadline_hours),
      max_participants_per_reservation: int(form!.max_participants_per_reservation),
      data_retention_months: int(form!.data_retention_months),
    };
    if (Object.values(values).some((n) => Number.isNaN(n)) || reminders.some((n) => Number.isNaN(n) || n < 1)) {
      setMessage({ text: 'Certaines valeurs numériques sont invalides.', tone: 'danger' });
      return;
    }
    if (form!.organizer_email && !EMAIL_RE.test(form!.organizer_email.trim())) {
      setMessage({ text: 'Adresse e-mail invalide.', tone: 'danger' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await adminUpdateSettings({
        organizer_name: form!.organizer_name.trim(),
        organizer_email: form!.organizer_email.trim() || null,
        organizer_phone: form!.organizer_phone.trim() || null,
        reminder_offsets_hours: reminders,
        ...values,
      });
      setMessage({ text: 'Paramètres enregistrés.', tone: 'success' });
    } catch (e) {
      setMessage({ text: toAppError(e).message, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen header={header} footer={<Button title="Enregistrer" onPress={save} loading={saving} />}>
        {message ? <Banner message={message.text} tone={message.tone} /> : null}
        <SectionTitle>Organisateur</SectionTitle>
        <Field label="Nom affiché" value={form.organizer_name} onChangeText={(v) => set('organizer_name', v)} />
        <Field label="E-mail de contact" value={form.organizer_email} onChangeText={(v) => set('organizer_email', v)}
          keyboardType="email-address" autoCapitalize="none" hint="Adresse de réponse des e-mails de confirmation." />
        <Field label="Téléphone de contact" value={form.organizer_phone} onChangeText={(v) => set('organizer_phone', v)} keyboardType="phone-pad" />

        <SectionTitle>Réservations</SectionTitle>
        <Field label="Capacité par défaut" value={form.default_capacity} onChangeText={(v) => set('default_capacity', v)} keyboardType="number-pad" />
        <Field label="Participants max. par réservation" value={form.max_participants_per_reservation}
          onChangeText={(v) => set('max_participants_per_reservation', v)} keyboardType="number-pad" />
        <Field label="Délai d'annulation par défaut (heures)" value={form.default_cancellation_deadline_hours}
          onChangeText={(v) => set('default_cancellation_deadline_hours', v)} keyboardType="number-pad" />

        <SectionTitle>Rappels</SectionTitle>
        <Field label="Rappels (heures avant le départ)" value={form.reminders} onChangeText={(v) => set('reminders', v)}
          hint="Ex. « 24, 3 » : la veille et 3 h avant. Le plus éloigné est aussi envoyé par e-mail." />

        <SectionTitle>Données personnelles</SectionTitle>
        <Field label="Conservation (mois après la dernière sortie)" value={form.data_retention_months}
          onChangeText={(v) => set('data_retention_months', v)} keyboardType="number-pad" />
        <Body muted>Au-delà, les coordonnées des participants sont anonymisées automatiquement.</Body>
      </Screen>
    </KeyboardAvoidingView>
  );
}
