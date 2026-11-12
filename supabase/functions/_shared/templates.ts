// Contenu des e-mails et notifications push (Spécifications V1 §8).
// Module sans dépendance (testable sous Node : supabase/functions/_shared/templates.test.ts).

export type Attendee = {
  id: string;
  position: number;
  first_name: string;
  last_name: string;
  attendance_status: string;
  qr_token: string | null;
};

export type Reservation = {
  id: string;
  status: string;
  participant_count: number;
  total_amount_cents: number;
  access_token: string;
  cancellation_deadline: string;
  contact: { first_name: string; last_name: string; email: string; phone: string | null };
  event: {
    id: string;
    title: string;
    starts_at: string;
    meeting_point: string;
    meeting_point_url: string | null;
    equipment: string | null;
    instructions: string | null;
  };
  attendees: Attendee[];
};

export type Settings = {
  organizer_name: string;
  organizer_email: string | null;
  organizer_phone: string | null;
};

export type NotificationKind = 'reservation_confirmed' | 'reservation_cancelled' | 'event_cancelled' | 'reminder';

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
  /** Participants dont le QR code doit être joint en image (cid:qr-<id>). */
  qrAttendees: Attendee[];
};

const TZ = 'Europe/Paris';

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function reservationLink(appScheme: string, accessToken: string): string {
  return `${appScheme}://reservation?token=${encodeURIComponent(accessToken)}`;
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\n/g, '<br>');
}

export function buildEmail(
  kind: NotificationKind,
  r: Reservation,
  settings: Settings,
  opts: { appScheme: string; offsetHours?: number },
): EmailContent {
  const brand = settings.organizer_name || 'Rando Pleine Lune Lyon Beaujolais';
  const when = formatDateTime(r.event.starts_at);
  const link = reservationLink(opts.appScheme, r.access_token);
  const active = r.attendees.filter((a) => a.qr_token && a.attendance_status !== 'cancelled');

  let subject: string;
  let intro: string;
  let showQr = false;
  switch (kind) {
    case 'reservation_confirmed':
      subject = `Réservation confirmée — ${brand}`;
      intro = `Votre réservation pour « ${r.event.title} » est confirmée.`;
      showQr = true;
      break;
    case 'reminder':
      subject = `Rappel : ${r.event.title} — ${brand}`;
      intro = opts.offsetHours && opts.offsetHours >= 24
        ? `Petit rappel : votre randonnée « ${r.event.title} » a lieu demain.`
        : `Petit rappel : votre randonnée « ${r.event.title} » commence bientôt.`;
      showQr = true;
      break;
    case 'reservation_cancelled':
      subject = `Réservation annulée — ${brand}`;
      intro = `Votre réservation pour « ${r.event.title} » a bien été annulée. Les QR codes associés ne sont plus valables.`;
      break;
    case 'event_cancelled':
      subject = `Sortie annulée : ${r.event.title} — ${brand}`;
      intro = `Nous sommes désolés : la sortie « ${r.event.title} » est annulée. Votre réservation est annulée et aucun paiement n'est dû.`;
      break;
  }

  const rows: [string, string][] = [
    ['Sortie', r.event.title],
    ['Date et heure', when],
    ['Point de rendez-vous', r.event.meeting_point],
    ['Participants', String(r.participant_count)],
  ];
  if (showQr) {
    rows.push(['Montant à régler sur place', formatPrice(r.total_amount_cents)]);
  }

  const contactLine = [settings.organizer_email, settings.organizer_phone].filter(Boolean).join(' · ');

  const text = [
    `Bonjour ${r.contact.first_name},`,
    '',
    intro,
    '',
    ...rows.map(([k, v]) => `${k} : ${v}`),
    r.event.meeting_point_url && showQr ? `Itinéraire : ${r.event.meeting_point_url}` : null,
    showQr && r.event.equipment ? `\nÉquipement conseillé : ${r.event.equipment}` : null,
    showQr && r.event.instructions ? `Consignes : ${r.event.instructions}` : null,
    showQr ? '\nPrésentez le QR code de chaque participant à l\'organisateur à l\'arrivée (joint à cet e-mail et disponible dans l\'application).' : null,
    showQr ? `Retrouver ou annuler votre réservation dans l'application : ${link}` : null,
    '',
    `À bientôt sous la lune,`,
    brand,
    contactLine || null,
  ].filter((l) => l !== null).join('\n');

  const qrHtml = showQr
    ? active.map((a) => `
        <td style="padding:8px;text-align:center;vertical-align:top">
          <img src="cid:qr-${a.id}" width="180" height="180" alt="QR code de ${escapeHtml(a.first_name)}" style="display:block;margin:0 auto">
          <div style="font-size:13px;color:#202936;margin-top:6px">${escapeHtml(a.first_name)} ${escapeHtml(a.last_name)}</div>
        </td>`).join('')
    : '';

  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#F3F5F8;font-family:Helvetica,Arial,sans-serif;color:#202936">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F8;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#14243A;padding:28px 24px;text-align:center">
    <div style="width:28px;height:28px;border-radius:14px;background:#D8B66A;margin:0 auto 12px"></div>
    <div style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:1px">RANDO PLEINE LUNE</div>
    <div style="color:#cfd6e0;font-size:12px;letter-spacing:1px">LYON BEAUJOLAIS</div>
  </td></tr>
  <tr><td style="padding:24px">
    <p style="margin:0 0 12px">Bonjour ${escapeHtml(r.contact.first_name)},</p>
    <p style="margin:0 0 20px">${escapeHtml(intro)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      ${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#5b6575;width:45%">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:bold">${escapeHtml(v)}</td></tr>`).join('')}
    </table>
    ${showQr && r.event.meeting_point_url ? `<p style="margin:16px 0 0"><a href="${escapeHtml(r.event.meeting_point_url)}" style="color:#203651">Voir le point de rendez-vous</a></p>` : ''}
    ${showQr && r.event.equipment ? `<p style="margin:16px 0 0;font-size:14px"><strong>Équipement conseillé :</strong><br>${nl2br(r.event.equipment)}</p>` : ''}
    ${showQr && r.event.instructions ? `<p style="margin:12px 0 0;font-size:14px"><strong>Consignes :</strong><br>${nl2br(r.event.instructions)}</p>` : ''}
    ${showQr ? `<p style="margin:24px 0 8px;font-size:14px">Présentez le QR code de chaque participant à l'organisateur à l'arrivée :</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${qrHtml}</tr></table>
    <p style="margin:20px 0 0;text-align:center"><a href="${escapeHtml(link)}" style="display:inline-block;background:#203651;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Ouvrir ma réservation</a></p>
    <p style="margin:12px 0 0;font-size:12px;color:#5b6575;text-align:center">Paiement sur place. Annulation possible dans l'application jusqu'au ${escapeHtml(formatDateTime(r.cancellation_deadline))}.</p>` : ''}
  </td></tr>
  <tr><td style="padding:16px 24px;background:#F3F5F8;font-size:12px;color:#5b6575;text-align:center">
    ${escapeHtml(brand)}${contactLine ? `<br>${escapeHtml(contactLine)}` : ''}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, html, text, qrAttendees: showQr ? active : [] };
}

export function buildPush(kind: NotificationKind, r: Reservation, offsetHours?: number): { title: string; body: string } {
  const when = formatDateTime(r.event.starts_at);
  switch (kind) {
    case 'reservation_confirmed':
      return { title: 'Réservation confirmée', body: `${r.event.title} — ${when}. Vos QR codes sont dans l'application.` };
    case 'reminder':
      return {
        title: offsetHours && offsetHours >= 24 ? 'C\'est demain !' : 'C\'est bientôt !',
        body: `${r.event.title} — rendez-vous ${r.event.meeting_point}, ${when}. N'oubliez pas votre frontale.`,
      };
    case 'reservation_cancelled':
      return { title: 'Réservation annulée', body: `Votre réservation pour ${r.event.title} est annulée.` };
    case 'event_cancelled':
      return { title: 'Sortie annulée', body: `${r.event.title} est annulée. Votre réservation est annulée.` };
  }
}
