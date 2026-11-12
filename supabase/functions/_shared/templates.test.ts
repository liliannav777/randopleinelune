// node --experimental-strip-types --test supabase/functions/_shared/templates.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEmail, buildPush, escapeHtml, formatPrice, type Reservation } from './templates.ts';

const reservation: Reservation = {
  id: 'r1', status: 'confirmed', participant_count: 2, total_amount_cents: 4000, access_token: 'tok/+=',
  cancellation_deadline: '2026-11-27T19:00:00Z',
  contact: { first_name: 'Camille', last_name: 'Martin', email: 'c@example.org', phone: '0600000000' },
  event: { id: 'e1', title: 'Nocturne <Beaujolais>', starts_at: '2026-11-28T19:00:00Z', meeting_point: 'Oingt',
    meeting_point_url: null, equipment: 'Frontale', instructions: null },
  attendees: [
    { id: 'a1', position: 1, first_name: 'Camille', last_name: 'Martin', attendance_status: 'expected', qr_token: 'RPL1.x' },
    { id: 'a2', position: 2, first_name: 'Léo', last_name: 'Martin', attendance_status: 'expected', qr_token: 'RPL1.y' },
  ],
};
const settings = { organizer_name: 'Rando Pleine Lune Lyon Beaujolais', organizer_email: 'orga@example.org', organizer_phone: null };

test('e-mail de confirmation : objet, récapitulatif, QR codes, échappement', () => {
  const m = buildEmail('reservation_confirmed', reservation, settings, { appScheme: 'randopleinelune' });
  assert.equal(m.subject, 'Réservation confirmée — Rando Pleine Lune Lyon Beaujolais');
  assert.equal(m.qrAttendees.length, 2);
  assert.match(m.html, /cid:qr-a1/);
  assert.match(m.html, /cid:qr-a2/);
  assert.match(m.html, /Nocturne &lt;Beaujolais&gt;/);
  assert.doesNotMatch(m.html, /<Beaujolais>/);
  assert.match(m.text, /Oingt/);
  assert.match(m.text, /40,00\s€/);
  assert.match(m.text, /randopleinelune:\/\/reservation\?token=tok%2F%2B%3D/);
  assert.match(m.text, /samedi 28 novembre 2026 à 20:00/);
});

test('e-mail d\'annulation : pas de QR code', () => {
  const m = buildEmail('event_cancelled', reservation, settings, { appScheme: 'x' });
  assert.equal(m.qrAttendees.length, 0);
  assert.doesNotMatch(m.html, /cid:qr/);
});

test('push de rappel J-1', () => {
  assert.equal(buildPush('reminder', reservation, 24).title, "C'est demain !");
});

test('utilitaires', () => {
  assert.equal(escapeHtml(`<a href="x">'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;');
  assert.match(formatPrice(2000), /20,00\s€/);
});
