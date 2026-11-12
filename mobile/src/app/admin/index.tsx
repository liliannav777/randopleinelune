import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NightSky } from '@/components/art';
import { eventStatusBadge } from '@/components/EventCard';
import {
  Banner, Button, Empty, Header, Icon, IconButton, Loading, ProgressBar, Screen, SectionTitle, StatTile, type IconName,
} from '@/components/ui';
import { adminEventStats, adminListEvents } from '@/lib/api';
import { useAdminAuth } from '@/lib/adminAuth';
import { capitalize, formatDate, formatPrice, formatShortDate, formatTime } from '@/lib/format';
import type { EventStats, HikeEvent } from '@/lib/types';
import { useFocusData } from '@/lib/useAsync';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

function pickDefault(events: HikeEvent[]): HikeEvent | undefined {
  const now = Date.now() - 12 * 3600 * 1000; // une sortie reste « en cours » 12 h
  return events.find((e) => new Date(e.starts_at).getTime() >= now && e.status !== 'draft')
    ?? events.find((e) => new Date(e.starts_at).getTime() >= now)
    ?? events[events.length - 1];
}

function Action({ icon, title, onPress, primary }: { icon: IconName; title: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.action, primary && s.actionPrimary, shadow(1), pressed && { opacity: 0.85 }]}>
      <View style={[s.actionIcon, primary && { backgroundColor: colors.accent }]}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={[s.actionText, primary && { color: colors.onPrimary }]}>{title}</Text>
    </Pressable>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const { signOut } = useAdminAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: events, error, loading, refreshing, refresh } = useFocusData(adminListEvents);
  const selected = events?.find((e) => e.id === selectedId) ?? (events ? pickDefault(events) : undefined);

  const [loadedStats, setLoadedStats] = useState<EventStats | null>(null);
  const selectedEventId = selected?.id;
  const seatsTaken = selected?.seats_taken;
  useEffect(() => {
    let alive = true;
    if (selectedEventId) {
      adminEventStats(selectedEventId).then((s) => { if (alive) setLoadedStats(s); }).catch(() => undefined);
    }
    return () => { alive = false; };
  }, [selectedEventId, seatsTaken, refreshing]);
  const stats = loadedStats?.event_id === selectedEventId ? loadedStats : null;

  return (
    <Screen
      header={<Header title="Tableau de bord" subtitle="Espace organisateur" seed="admin" onBack={() => router.replace('/')}
        right={<IconButton icon="settings-outline" onPress={() => router.push('/admin/parametres')} label="Paramètres" />} />}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {error ? <Banner message={error.message} /> : null}
      {loading && !events ? <Loading /> : null}

      {events && events.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.selector}
          style={{ marginHorizontal: -spacing.lg }}>
          {events.map((e) => {
            const active = e.id === selected?.id;
            return (
              <Pressable key={e.id} onPress={() => setSelectedId(e.id)} accessibilityRole="button"
                accessibilityState={{ selected: active }} style={[s.pill, active && s.pillActive]}>
                <Text style={[s.pillDate, active && { color: colors.accentLight }]}>{formatShortDate(e.starts_at)}</Text>
                <Text style={[s.pillTitle, active && { color: colors.onPrimary }]} numberOfLines={1}>{e.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {events?.length === 0 ? <Empty title="Aucune sortie" message="Créez votre première randonnée." /> : null}

      {selected ? (
        <>
          <View style={s.eventCard}>
            <NightSky height={200} seed={selected.id} moon={{ x: 350, y: 40, r: 14 }} stars={30} />
            {eventStatusBadge(selected)}
            <Text style={s.eventTitle}>{selected.title}</Text>
            <Text style={s.eventMeta}>
              {capitalize(formatDate(selected.starts_at))} · {formatTime(selected.starts_at)} · {selected.meeting_point}
            </Text>
            <View style={{ gap: 6, marginTop: spacing.sm }}>
              <View style={s.capRow}>
                <Text style={s.capText}>{selected.seats_taken} / {selected.capacity} places réservées</Text>
                <Text style={s.capText}>{Math.max(0, selected.capacity - selected.seats_taken)} libres</Text>
              </View>
              <ProgressBar value={selected.seats_taken} max={selected.capacity} />
            </View>
          </View>

          <View style={s.grid}>
            <StatTile icon="receipt-outline" label="Réservations" value={stats ? String(stats.reservations) : '…'} />
            <StatTile icon="person-circle-outline" label="Présents" value={stats ? String(stats.present) : '…'}
              sub={stats ? `sur ${stats.seats_taken} attendus` : undefined} />
            <StatTile icon="checkmark-done-outline" label="Paiements reçus" value={stats ? String(stats.payments_received) : '…'}
              sub={stats ? `sur ${stats.reservations} réservations` : undefined} />
            <StatTile icon="wallet-outline" label="Encaissé" value={stats ? formatPrice(stats.amount_paid_cents) : '…'}
              sub={stats ? `attendu ${formatPrice(stats.amount_due_cents)}` : undefined} />
          </View>

          <SectionTitle>Actions</SectionTitle>
          <View style={s.grid}>
            <Action primary icon="scan-outline" title="Scanner un QR code" onPress={() => router.push(`/admin/scanner/${selected.id}`)} />
            <Action icon="people-outline" title="Participants" onPress={() => router.push(`/admin/participants/${selected.id}`)} />
            <Action icon="create-outline" title="Modifier la sortie" onPress={() => router.push(`/admin/sortie/${selected.id}`)} />
            <Action icon="add-circle-outline" title="Nouvelle sortie" onPress={() => router.push('/admin/sortie/nouvelle')} />
          </View>
        </>
      ) : (
        <Button variant="gold" icon="add-circle-outline" title="Nouvelle randonnée" onPress={() => router.push('/admin/sortie/nouvelle')} />
      )}

      <Button variant="ghost" icon="log-out-outline" title="Se déconnecter" onPress={signOut} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  selector: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 2 },
  pill: {
    backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1.5, borderColor: colors.border, maxWidth: 200,
  },
  pillActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  pillDate: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.8, color: colors.accentDark, textTransform: 'uppercase' },
  pillTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  eventCard: {
    borderRadius: radius.lg, overflow: 'hidden', padding: spacing.lg, gap: spacing.xs, backgroundColor: colors.primary,
    paddingBottom: spacing.xl,
  },
  eventTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.onPrimary, marginTop: spacing.xs },
  eventMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.onPrimaryMuted },
  capRow: { flexDirection: 'row', justifyContent: 'space-between' },
  capText: { fontFamily: fonts.medium, fontSize: 12, color: colors.onPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  action: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    gap: spacing.md, minHeight: 112,
  },
  actionPrimary: { backgroundColor: colors.secondary },
  actionIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  actionText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
