import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { ReservationAttendee } from '@/lib/types';
import { colors, spacing } from '@/theme';
import { Badge, Card, styles } from './ui';

export function QrCard({ attendee, total }: { attendee: ReservationAttendee; total: number }) {
  const label = `${attendee.first_name} ${attendee.last_name}`;
  return (
    <Card style={{ alignItems: 'center' }}>
      <Text style={[styles.body, { fontWeight: '700' }]}>{label}</Text>
      {total > 1 ? <Text style={styles.fieldHint}>Participant {attendee.position} / {total}</Text> : null}
      {attendee.attendance_status === 'present' ? <Badge label="Présence enregistrée" tone="success" /> : null}
      {attendee.qr_token ? (
        <View style={{ padding: spacing.md, backgroundColor: colors.surface }}
          accessible accessibilityRole="image" accessibilityLabel={`QR code de ${label}`}>
          <QRCode value={attendee.qr_token} size={200} color={colors.primary} backgroundColor={colors.surface} ecl="M" />
        </View>
      ) : (
        <Badge label="QR code annulé" tone="danger" />
      )}
    </Card>
  );
}
