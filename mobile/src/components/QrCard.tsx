// Billet d'entrée : un QR code par participant, présenté comme un ticket.
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { capitalize, formatDate, formatTime } from '@/lib/format';
import type { ReservationAttendee } from '@/lib/types';
import { fonts, radius, shadow, spacing, type Colors } from '@/theme';
import { MoonMark } from './art';
import { Badge } from './ui';
import { useColors, useStyles } from '@/lib/theme';

export function QrCard({ attendee, total, eventTitle, startsAt }: {
  attendee: ReservationAttendee; total: number; eventTitle?: string; startsAt?: string;
}) {
  const colors = useColors();
  const s = useStyles(makeStyles);
  const label = `${attendee.first_name} ${attendee.last_name}`;
  return (
    <View style={[s.ticket, shadow(2)]}>
      <View style={s.top}>
        <MoonMark size={30} />
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{total > 1 ? `BILLET ${attendee.position} / ${total}` : 'BILLET'}</Text>
          <Text style={s.name} numberOfLines={1}>{label}</Text>
        </View>
        {attendee.attendance_status === 'present' ? <Badge label="Présent" tone="success" /> : null}
      </View>
      {eventTitle && startsAt ? (
        <Text style={s.event} numberOfLines={2}>
          {eventTitle} · {capitalize(formatDate(startsAt))} à {formatTime(startsAt)}
        </Text>
      ) : null}

      <View style={s.perforation}>
        <View style={[s.notch, { left: -spacing.lg - 12 }]} />
        <View style={s.dashes} />
        <View style={[s.notch, { right: -spacing.lg - 12 }]} />
      </View>

      {attendee.qr_token ? (
        <View style={s.qrWrap} accessible accessibilityRole="image" accessibilityLabel={`QR code de ${label}`}>
          {/* Toujours foncé sur blanc, quel que soit le thème, pour rester lisible au scanner. */}
          <View style={s.qrBox}>
            <QRCode value={attendee.qr_token} size={196} color={colors.primary} backgroundColor={colors.white} ecl="M" />
          </View>
          <Text style={s.hint}>À présenter à l’organisateur à l’arrivée</Text>
        </View>
      ) : (
        <View style={s.qrWrap}><Badge label="QR code annulé" tone="danger" /></View>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  ticket: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.4, color: colors.accentDark },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  event: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  perforation: { height: 24, justifyContent: 'center' },
  dashes: { borderTopWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.background, top: 0 },
  qrBox: { backgroundColor: colors.white, padding: 12, borderRadius: radius.md },
  qrWrap: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xs },
  hint: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
});
