// Billet d'entrée : un QR code par participant, présenté comme un ticket.
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { formatDate, formatTime } from '@/lib/format';
import type { ReservationAttendee } from '@/lib/types';
import { fonts, radius, spacing, type Colors } from '@/theme';
import { Badge } from './ui';
import { useColors, useStyles } from '@/lib/theme';

export function QrCard({ attendee, total, eventTitle, startsAt }: {
  attendee: ReservationAttendee; total: number; eventTitle?: string; startsAt?: string;
}) {
  const colors = useColors();
  const s = useStyles(makeStyles);
  const label = `${attendee.first_name} ${attendee.last_name}`;
  return (
    <View style={s.ticket}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{total > 1 ? `Billet ${attendee.position} sur ${total}` : 'Billet'}</Text>
          <Text style={s.name} numberOfLines={1}>{label}</Text>
        </View>
        {attendee.attendance_status === 'present' ? <Badge label="Présent" tone="success" /> : null}
      </View>
      {eventTitle && startsAt ? (
        <Text style={s.event} numberOfLines={2}>
          {eventTitle}, {formatDate(startsAt)} à {formatTime(startsAt)}
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
        </View>
      ) : (
        <View style={s.qrWrap}><Badge label="QR code annulé" tone="danger" /></View>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  ticket: {
    backgroundColor: colors.surface, borderRadius: 12, padding: spacing.lg, gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eyebrow: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  name: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  event: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  perforation: { height: 24, justifyContent: 'center' },
  dashes: { borderTopWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  notch: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.background, top: 0,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong,
  },
  qrBox: { backgroundColor: colors.white, padding: 12, borderRadius: radius.md },
  qrWrap: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xs },
});
