import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { EventCover } from '@/components/EventCard';
import { Banner, Body, Button, Chips, Field, Header, Loading, Screen, SectionTitle } from '@/components/ui';
import { adminSaveEvent, adminUploadCover, getEvent, getSettings, type EventInput } from '@/lib/api';
import { toAppError } from '@/lib/errors';
import { centsToInput, parseEuros, parseParisDateTime, toParisInputs } from '@/lib/format';
import type { Difficulty, EventStatus, HikeEvent } from '@/lib/types';
import { spacing } from '@/theme';

type FormState = {
  title: string; summary: string; description: string;
  date: string; time: string; endTime: string;
  meetingPoint: string; meetingPointUrl: string;
  distance: string; elevation: string; difficulty: Difficulty | '';
  price: string; capacity: string; cancellationHours: string;
  equipment: string; instructions: string; coverImage: string | null;
  status: EventStatus;
};

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'published', label: 'Publiée' },
  { value: 'closed', label: 'Inscriptions closes' },
  { value: 'completed', label: 'Terminée' },
  { value: 'cancelled', label: 'Annulée' },
];

const DIFFICULTY_OPTIONS: { value: Difficulty | ''; label: string }[] = [
  { value: '', label: 'Non précisée' },
  { value: 'facile', label: 'Facile' },
  { value: 'moyenne', label: 'Moyenne' },
  { value: 'soutenue', label: 'Soutenue' },
  { value: 'difficile', label: 'Difficile' },
];

function fromEvent(e: HikeEvent): FormState {
  const start = toParisInputs(e.starts_at);
  return {
    title: e.title, summary: e.summary ?? '', description: e.description ?? '',
    date: start.date, time: start.time, endTime: e.ends_at ? toParisInputs(e.ends_at).time : '',
    meetingPoint: e.meeting_point, meetingPointUrl: e.meeting_point_url ?? '',
    distance: e.distance_km != null ? String(e.distance_km).replace('.', ',') : '',
    elevation: e.elevation_m != null ? String(e.elevation_m) : '',
    difficulty: e.difficulty ?? '',
    price: centsToInput(e.price_cents), capacity: String(e.capacity),
    cancellationHours: e.cancellation_deadline_hours != null ? String(e.cancellation_deadline_hours) : '',
    equipment: e.equipment ?? '', instructions: e.instructions ?? '', coverImage: e.cover_image, status: e.status,
  };
}

function toInput(f: FormState): { input?: EventInput; error?: string } {
  if (f.title.trim().length < 3) return { error: 'Le titre doit contenir au moins 3 caractères.' };
  const startsAt = parseParisDateTime(f.date, f.time);
  if (!startsAt) return { error: 'Date (JJ/MM/AAAA) ou heure (HH:MM) invalide.' };
  let endsAt: string | null = null;
  if (f.endTime.trim()) {
    endsAt = parseParisDateTime(f.date, f.endTime);
    if (!endsAt) return { error: 'Heure de retour invalide.' };
    // Retour après minuit : jour suivant.
    if (endsAt <= startsAt) endsAt = new Date(new Date(endsAt).getTime() + 24 * 3600 * 1000).toISOString();
  }
  if (!f.meetingPoint.trim()) return { error: 'Indiquez le lieu de rendez-vous.' };
  const price = parseEuros(f.price || '0');
  if (price == null) return { error: 'Tarif invalide.' };
  const capacity = parseInt(f.capacity, 10);
  if (!Number.isInteger(capacity) || capacity < 1) return { error: 'Capacité invalide.' };
  const distance = f.distance.trim() ? Number(f.distance.replace(',', '.')) : null;
  if (distance != null && (!Number.isFinite(distance) || distance < 0)) return { error: 'Distance invalide.' };
  const elevation = f.elevation.trim() ? parseInt(f.elevation, 10) : null;
  if (elevation != null && (!Number.isInteger(elevation) || elevation < 0)) return { error: 'Dénivelé invalide.' };
  const cancel = f.cancellationHours.trim() ? parseInt(f.cancellationHours, 10) : null;
  if (cancel != null && (!Number.isInteger(cancel) || cancel < 0)) return { error: "Délai d'annulation invalide." };
  if (f.meetingPointUrl.trim() && !/^https?:\/\//.test(f.meetingPointUrl.trim())) {
    return { error: 'Le lien du rendez-vous doit commencer par https://' };
  }
  const opt = (s: string) => (s.trim() ? s.trim() : null);
  return {
    input: {
      title: f.title.trim(), summary: opt(f.summary), description: opt(f.description),
      starts_at: startsAt, ends_at: endsAt,
      meeting_point: f.meetingPoint.trim(), meeting_point_url: opt(f.meetingPointUrl),
      distance_km: distance, elevation_m: elevation, difficulty: f.difficulty || null,
      price_cents: price, capacity, cancellation_deadline_hours: cancel,
      equipment: opt(f.equipment), instructions: opt(f.instructions), cover_image: f.coverImage, status: f.status,
    },
  };
}

export default function EventForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nouvelle';
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [original, setOriginal] = useState<HikeEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (isNew) {
          const s = await getSettings();
          setForm({
            title: '', summary: '', description: '', date: '', time: '19:00', endTime: '',
            meetingPoint: '', meetingPointUrl: '', distance: '', elevation: '', difficulty: '',
            price: '20', capacity: String(s.default_capacity), cancellationHours: '',
            equipment: 'Chaussures de randonnée, lampe frontale, vêtements chauds, eau.',
            instructions: 'Arrivée 15 minutes avant le départ. Présentez votre QR code à l\'accueil. Paiement sur place.',
            coverImage: null, status: 'draft',
          });
        } else {
          const e = await getEvent(id);
          if (!e) throw new Error('Sortie introuvable.');
          setOriginal(e);
          setForm(fromEvent(e));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : toAppError(e).message);
      }
    })();
  }, [id, isNew]);

  const header = <Header title={isNew ? 'Nouvelle randonnée' : 'Modifier la randonnée'} onBack={() => router.back()} />;
  if (!form) return <Screen header={header}>{error ? <Banner message={error} /> : <Loading />}</Screen>;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function pickCover() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [16, 9] });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    setError(null);
    try {
      set('coverImage', await adminUploadCover(asset.uri, asset.mimeType ?? 'image/jpeg'));
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setUploading(false);
    }
  }

  async function doSave(input: EventInput) {
    setSaving(true);
    setError(null);
    try {
      await adminSaveEvent(isNew ? null : id, input);
      router.back();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setSaving(false);
    }
  }

  function save() {
    const { input, error: err } = toInput(form!);
    if (!input) { setError(err ?? null); return; }
    if (original && input.status === 'cancelled' && original.status !== 'cancelled') {
      Alert.alert('Annuler la sortie ?',
        `Les ${original.seats_taken} place(s) réservées seront annulées et les participants prévenus par e-mail et notification.`,
        [{ text: 'Non', style: 'cancel' }, { text: 'Annuler la sortie', style: 'destructive', onPress: () => doSave(input) }]);
      return;
    }
    doSave(input);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen header={header} footer={<Button title="Enregistrer" onPress={save} loading={saving} disabled={uploading} />}>
        {error ? <Banner message={error} /> : null}

        <SectionTitle>Publication</SectionTitle>
        <Chips options={STATUS_OPTIONS} value={form.status} onChange={(v) => set('status', v)} />
        <Body muted>Seules les sorties publiées acceptent des réservations. Un brouillon n’est pas visible du public.</Body>

        <SectionTitle>Présentation</SectionTitle>
        <EventCover uri={form.coverImage} height={150} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button variant="secondary" title={form.coverImage ? 'Changer la photo' : 'Ajouter une photo'} onPress={pickCover}
            loading={uploading} style={{ flex: 1 }} />
          {form.coverImage ? <Button variant="ghost" title="Retirer" onPress={() => set('coverImage', null)} /> : null}
        </View>
        <Field label="Titre" value={form.title} onChangeText={(v) => set('title', v)} maxLength={140} />
        <Field label="Résumé (liste des sorties)" value={form.summary} onChangeText={(v) => set('summary', v)} multiline />
        <Field label="Description" value={form.description} onChangeText={(v) => set('description', v)} multiline />

        <SectionTitle>Date et rendez-vous</SectionTitle>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 3 }}><Field label="Date" value={form.date} onChangeText={(v) => set('date', v)} placeholder="JJ/MM/AAAA" keyboardType="numbers-and-punctuation" /></View>
          <View style={{ flex: 2 }}><Field label="Heure" value={form.time} onChangeText={(v) => set('time', v)} placeholder="HH:MM" keyboardType="numbers-and-punctuation" /></View>
        </View>
        <Field label="Heure de retour (facultatif)" value={form.endTime} onChangeText={(v) => set('endTime', v)} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
        <Field label="Lieu de rendez-vous" value={form.meetingPoint} onChangeText={(v) => set('meetingPoint', v)} />
        <Field label="Lien carte (facultatif)" value={form.meetingPointUrl} onChangeText={(v) => set('meetingPointUrl', v)}
          autoCapitalize="none" keyboardType="url" placeholder="https://maps.google.com/?q=…" />

        <SectionTitle>Parcours</SectionTitle>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Distance (km)" value={form.distance} onChangeText={(v) => set('distance', v)} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Dénivelé (m)" value={form.elevation} onChangeText={(v) => set('elevation', v)} keyboardType="number-pad" /></View>
        </View>
        <Chips options={DIFFICULTY_OPTIONS} value={form.difficulty} onChange={(v) => set('difficulty', v)} />

        <SectionTitle>Inscriptions</SectionTitle>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}><Field label="Tarif / personne (€)" value={form.price} onChangeText={(v) => set('price', v)} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Capacité" value={form.capacity} onChangeText={(v) => set('capacity', v)} keyboardType="number-pad"
            hint={original ? `${original.seats_taken} déjà réservée(s)` : undefined} /></View>
        </View>
        <Field label="Délai d'annulation (heures avant le départ)" value={form.cancellationHours}
          onChangeText={(v) => set('cancellationHours', v)} keyboardType="number-pad" hint="Vide = valeur par défaut des paramètres." />
        <Body muted>Modifier le tarif ne change pas le montant des réservations déjà enregistrées.</Body>

        <SectionTitle>Informations pratiques</SectionTitle>
        <Field label="Équipement conseillé" value={form.equipment} onChangeText={(v) => set('equipment', v)} multiline />
        <Field label="Consignes" value={form.instructions} onChangeText={(v) => set('instructions', v)} multiline />
      </Screen>
    </KeyboardAvoidingView>
  );
}
