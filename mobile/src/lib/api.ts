import { supabase } from './supabase';
import { toAppError } from './errors';
import type {
  AppSettings, AttendeeAdminInfo, EventStats, HikeEvent, ParticipantFilter, ParticipantRow, PaymentMethod, Reservation,
} from './types';

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toAppError(error);
  return data as T;
}

const EVENT_COLUMNS = 'id,title,summary,description,starts_at,ends_at,meeting_point,meeting_point_url,distance_km,'
  + 'elevation_m,difficulty,price_cents,capacity,seats_taken,equipment,instructions,cover_image,'
  + 'cancellation_deadline_hours,status';

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
export async function listUpcomingEvents(): Promise<HikeEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .in('status', ['published', 'closed', 'cancelled'])
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(50);
  if (error) throw toAppError(error);
  return (data ?? []) as unknown as HikeEvent[];
}

export async function listPastEvents(limit = 20): Promise<HikeEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .in('status', ['published', 'closed', 'completed'])
    .lt('starts_at', new Date().toISOString())
    .not('cover_image', 'is', null)
    .order('starts_at', { ascending: false })
    .limit(limit);
  if (error) throw toAppError(error);
  return (data ?? []) as unknown as HikeEvent[];
}

export async function getEvent(id: string): Promise<HikeEvent | null> {
  const { data, error } = await supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw toAppError(error);
  return data as unknown as HikeEvent | null;
}

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from('app_settings').select('*').single();
  if (error) throw toAppError(error);
  return data as AppSettings;
}

export type CreateReservationInput = {
  eventId: string;
  idempotencyKey: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  participantCount: number;
  attendees: { first_name: string; last_name: string }[];
  acceptTerms: boolean;
  acceptPrivacy: boolean;
};

export function createReservation(i: CreateReservationInput): Promise<Reservation> {
  return rpc<Reservation>('create_reservation', {
    p_event_id: i.eventId,
    p_idempotency_key: i.idempotencyKey,
    p_first_name: i.firstName,
    p_last_name: i.lastName,
    p_email: i.email,
    p_phone: i.phone,
    p_participant_count: i.participantCount,
    p_attendees: i.attendees,
    p_accept_terms: i.acceptTerms,
    p_accept_privacy: i.acceptPrivacy,
  });
}

export function getReservations(accessTokens: string[]): Promise<Reservation[]> {
  if (accessTokens.length === 0) return Promise.resolve([]);
  return rpc<Reservation[]>('get_reservations', { p_access_tokens: accessTokens });
}

export function cancelReservation(accessToken: string): Promise<Reservation & { already_cancelled: boolean }> {
  return rpc('cancel_reservation', { p_access_token: accessToken });
}

export function registerPushToken(accessToken: string, pushToken: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
  return rpc('register_push_token', { p_access_token: accessToken, p_push_token: pushToken, p_platform: platform });
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------
export async function adminListEvents(): Promise<HikeEvent[]> {
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .gte('starts_at', since)
    .order('starts_at', { ascending: true })
    .limit(100);
  if (error) throw toAppError(error);
  return (data ?? []) as unknown as HikeEvent[];
}

export type EventInput = Omit<HikeEvent, 'id' | 'seats_taken'>;

export async function adminSaveEvent(id: string | null, input: EventInput): Promise<HikeEvent> {
  const query = id
    ? supabase.from('events').update(input).eq('id', id)
    : supabase.from('events').insert(input);
  const { data, error } = await query.select(EVENT_COLUMNS).single();
  if (error) throw toAppError(error);
  return data as unknown as HikeEvent;
}

export async function adminUploadCover(localUri: string, mimeType: string): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${new Date().getFullYear()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from('event-photos').upload(path, body, { contentType: mimeType });
  if (error) throw toAppError(error);
  return supabase.storage.from('event-photos').getPublicUrl(path).data.publicUrl;
}

export function adminEventStats(eventId: string): Promise<EventStats> {
  return rpc('admin_event_stats', { p_event_id: eventId });
}

export function adminListParticipants(eventId: string, search: string, filter: ParticipantFilter): Promise<ParticipantRow[]> {
  return rpc('admin_list_participants', { p_event_id: eventId, p_search: search || null, p_filter: filter });
}

export function adminLookupQr(qrToken: string, eventId: string): Promise<AttendeeAdminInfo> {
  return rpc('admin_lookup_qr', { p_qr_token: qrToken, p_event_id: eventId });
}

export function adminCheckIn(attendeeId: string, eventId: string, method: 'qr' | 'manual'): Promise<AttendeeAdminInfo> {
  return rpc('admin_check_in', { p_attendee_id: attendeeId, p_event_id: eventId, p_method: method });
}

export function adminUndoCheckIn(attendeeId: string): Promise<AttendeeAdminInfo> {
  return rpc('admin_undo_check_in', { p_attendee_id: attendeeId });
}

export function adminRecordPayment(reservationId: string, amountPaidCents: number, method: PaymentMethod | null) {
  return rpc('admin_record_payment', {
    p_reservation_id: reservationId, p_amount_paid_cents: amountPaidCents, p_method: method,
  });
}

export function adminCancelReservation(reservationId: string): Promise<{ cancelled: boolean }> {
  return rpc('admin_cancel_reservation', { p_reservation_id: reservationId });
}

export async function adminUpdateSettings(input: Partial<AppSettings>): Promise<void> {
  const { error } = await supabase.from('app_settings').update(input).eq('id', true);
  if (error) throw toAppError(error);
}

export function isAdmin(): Promise<boolean> {
  return rpc<boolean>('is_admin');
}
