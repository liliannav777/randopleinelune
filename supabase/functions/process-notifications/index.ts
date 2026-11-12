// Edge Function : traite la file `notification_outbox`.
//  - programme les rappels (enqueue_reminders) ;
//  - envoie les e-mails transactionnels (avec QR codes en images jointes) ;
//  - envoie les notifications push via le service Expo.
//
// Appelée périodiquement par pg_cron (voir supabase/cron.sql) et/ou par un
// Database Webhook sur l'insertion dans notification_outbox.
// Authentification : en-tête `Authorization: Bearer <NOTIFICATIONS_CRON_SECRET>`.
//
// Variables d'environnement :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (fournies par Supabase)
//   NOTIFICATIONS_CRON_SECRET                 secret partagé avec pg_cron
//   EMAIL_PROVIDER                            'resend' (défaut) ou 'log' (développement)
//   RESEND_API_KEY, EMAIL_FROM                ex. "Rando Pleine Lune <reservations@exemple.fr>"
//   EMAIL_REPLY_TO                            optionnel
//   APP_SCHEME                                schéma de lien profond (défaut : randopleinelune)
//   EXPO_ACCESS_TOKEN                         optionnel (sécurité renforcée des push)

import { createClient } from 'npm:@supabase/supabase-js@2';
import QRCode from 'npm:qrcode@1.5.4';
import { buildEmail, buildPush, type NotificationKind, type Reservation, type Settings } from '../_shared/templates.ts';

type Claimed = {
  id: number;
  kind: NotificationKind;
  channel: 'email' | 'push';
  payload: { offset_hours?: number };
  reservation: Reservation;
  push_tokens: string[];
  settings: Settings;
};

const env = (k: string, fallback?: string) => Deno.env.get(k) ?? fallback;

const supabase = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function qrPngBase64(token: string): Promise<string> {
  const dataUrl: string = await QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 2, width: 360 });
  return dataUrl.replace(/^data:image\/png;base64,/, '');
}

async function sendEmail(n: Claimed): Promise<void> {
  const r = n.reservation;
  const content = buildEmail(n.kind, r, n.settings, {
    appScheme: env('APP_SCHEME', 'randopleinelune')!,
    offsetHours: n.payload?.offset_hours,
  });

  const provider = env('EMAIL_PROVIDER', 'resend');
  if (provider === 'log') {
    console.log(`[email:log] to=${r.contact.email} subject=${content.subject}\n${content.text}`);
    return;
  }

  const attachments = await Promise.all(content.qrAttendees.map(async (a) => ({
    filename: `qr-${a.position}-${a.first_name}.png`.replace(/[^\w.-]+/g, '_'),
    content: await qrPngBase64(a.qr_token!),
    content_id: `qr-${a.id}`,
  })));

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json',
      'Idempotency-Key': `rpl-outbox-${n.id}` },
    body: JSON.stringify({
      from: env('EMAIL_FROM'),
      to: [r.contact.email],
      reply_to: env('EMAIL_REPLY_TO') ?? n.settings.organizer_email ?? undefined,
      subject: content.subject,
      html: content.html,
      text: content.text,
      attachments,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

// Retourne la liste des jetons devenus invalides (application désinstallée…).
async function sendPush(n: Claimed): Promise<string[]> {
  if (n.push_tokens.length === 0) return [];
  const { title, body } = buildPush(n.kind, n.reservation, n.payload?.offset_hours);
  const messages = n.push_tokens.map((to) => ({
    to, title, body, sound: 'default', channelId: 'reservations',
    data: { type: n.kind, reservationId: n.reservation.id },
  }));
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = env('EXPO_ACCESS_TOKEN');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST', headers, body: JSON.stringify(messages),
  });
  if (!res.ok) throw new Error(`Expo push ${res.status}: ${await res.text()}`);
  const json = await res.json() as { data: { status: string; details?: { error?: string } }[] };
  const invalid: string[] = [];
  json.data.forEach((ticket, i) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') invalid.push(n.push_tokens[i]);
  });
  return invalid;
}

Deno.serve(async (req) => {
  const secret = env('NOTIFICATIONS_CRON_SECRET');
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { error: remErr } = await supabase.rpc('enqueue_reminders');
  if (remErr) console.error('enqueue_reminders', remErr);

  const { data, error } = await supabase.rpc('claim_notifications', { p_limit: 25 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results = { sent: 0, failed: 0 };
  for (const n of (data ?? []) as Claimed[]) {
    let invalid: string[] = [];
    try {
      if (n.channel === 'email') await sendEmail(n);
      else invalid = await sendPush(n);
      await supabase.rpc('complete_notification', { p_id: n.id, p_success: true, p_invalid_push_tokens: invalid });
      results.sent++;
    } catch (e) {
      console.error(`notification ${n.id}`, e);
      await supabase.rpc('complete_notification', { p_id: n.id, p_success: false, p_error: String(e) });
      results.failed++;
    }
  }
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});
