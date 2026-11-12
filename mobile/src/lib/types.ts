export type EventStatus = 'draft' | 'published' | 'closed' | 'cancelled' | 'completed';
export type Difficulty = 'facile' | 'moyenne' | 'soutenue' | 'difficile';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';
export type AttendanceStatus = 'expected' | 'present' | 'cancelled';

export type HikeEvent = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  meeting_point: string;
  meeting_point_url: string | null;
  distance_km: number | null;
  elevation_m: number | null;
  difficulty: Difficulty | null;
  price_cents: number;
  capacity: number;
  seats_taken: number;
  equipment: string | null;
  instructions: string | null;
  cover_image: string | null;
  cancellation_deadline_hours: number | null;
  status: EventStatus;
};

export type ReservationAttendee = {
  id: string;
  position: number;
  first_name: string;
  last_name: string;
  attendance_status: AttendanceStatus;
  checked_in_at: string | null;
  qr_token: string | null;
};

export type Reservation = {
  id: string;
  status: 'confirmed' | 'cancelled';
  participant_count: number;
  total_amount_cents: number;
  created_at: string;
  cancelled_at: string | null;
  cancelled_by: 'participant' | 'admin' | 'event_cancelled' | null;
  access_token: string;
  can_cancel: boolean;
  cancellation_deadline: string;
  replayed?: boolean;
  contact: { first_name: string; last_name: string; email: string; phone: string | null };
  payment: { status: PaymentStatus; amount_due_cents: number; amount_paid_cents: number };
  event: Pick<HikeEvent, 'id' | 'title' | 'starts_at' | 'ends_at' | 'meeting_point' | 'meeting_point_url'
    | 'price_cents' | 'status' | 'equipment' | 'instructions' | 'cover_image'>;
  attendees: ReservationAttendee[];
};

export type AppSettings = {
  organizer_name: string;
  organizer_email: string | null;
  organizer_phone: string | null;
  default_capacity: number;
  default_cancellation_deadline_hours: number;
  max_participants_per_reservation: number;
  reminder_offsets_hours: number[];
  data_retention_months: number;
};

export type ScanResult = 'valid' | 'already_present' | 'cancelled' | 'wrong_event' | 'unknown' | 'checked_in';

export type AttendeeAdminInfo = {
  result: ScanResult;
  attendee?: { id: string; position: number; first_name: string; last_name: string;
    attendance_status: AttendanceStatus; checked_in_at: string | null };
  reservation?: { id: string; status: string; participant_count: number; total_amount_cents: number;
    contact: { first_name: string; last_name: string; email: string; phone: string | null } };
  payment?: { status: PaymentStatus; amount_due_cents: number; amount_paid_cents: number;
    method: PaymentMethod | null; paid_at: string | null };
  event?: { id: string; title: string; starts_at: string };
};

export type EventStats = {
  event_id: string;
  capacity: number;
  seats_taken: number;
  seats_left: number;
  reservations: number;
  present: number;
  payments_received: number;
  amount_due_cents: number;
  amount_paid_cents: number;
};

export type ParticipantRow = {
  attendee_id: string;
  first_name: string;
  last_name: string;
  position: number;
  attendance_status: AttendanceStatus;
  checked_in_at: string | null;
  reservation_id: string;
  reservation_status: 'confirmed' | 'cancelled';
  participant_count: number;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string;
  payment_status: PaymentStatus;
  amount_due_cents: number;
  amount_paid_cents: number;
};

export type ParticipantFilter = 'all' | 'confirmed' | 'present' | 'absent' | 'paid' | 'unpaid' | 'cancelled';
