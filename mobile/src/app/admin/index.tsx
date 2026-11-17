import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { eventStatusBadge } from '@/components/EventCard';
import { Banner, Button, Empty, Header, LinkText, Loading, ProgressBar, Screen } from '@/components/ui';
import { adminEventStats, adminListEvents } from '@/lib/api';
import { useAdminAuth } from '@/lib/adminAuth';
import { capitalize, formatDate, formatPrice, formatShortDate, formatTime } from '@/lib/format';
import type { EventStats, HikeEvent } from '@/lib/types';
import { useStyles } from '@/lib/theme';
import { useFocusData } from '@/lib/useAsync';
import { fonts, spacing, type Colors } from '@/theme';

function pickDefault(events: HikeEvent[]): HikeEvent | undefined {
  const now = Date.now() - 12 * 3600 * 1000; // une sortie reste « en cours » 12 h
  return events.find((e) => new Date(e.starts_at).getTime() >= now && e.status !== 'draft')
    ?? events.find((e) => new Date(e.starts_at).getTime() >= now)
    ?? events[events.length - 1];
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function AdminDashboard() {
  const s = useStyles(makeStyles);
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
      adminEventStats(selectedEventId).then((st) => { if (alive) setLoadedStats(st); }).catch(() => undefined);
    }
    return () => { alive = false; };
  }, [selectedEventId, seatsTaken, refreshing]);
  const stats = loadedStats?.event_id === selectedEventId ? loadedStats : null;
  const dash = '–';

  return (
    <Screen
      header={<Header title="Organisation" onBack={() => router.replace('/')}
        right={<LinkText onPress={() => router.push('/admin/parametres')}>Paramètres</LinkText>} />}
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
                <Text style={[s.pillText, active && s.pillTextActive]} numberOfLines={1}>
                  {formatShortDate(e.starts_at)} · {e.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {events?.length === 0 ? <Empty title="Aucune sortie pour l’instant" message="Commencez par créer votre première randonnée." /> : null}

      {selected ? (
        <>
          <View style={{ gap: 2, marginTop: spacing.sm }}>
            {eventStatusBadge(selected, true)}
            <Text style={s.eventTitle}>{selected.title}</Text>
            <Text style={s.eventMeta}>
              {capitalize(formatDate(selected.starts_at))}, {formatTime(selected.starts_at)} — {selected.meeting_point}
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={s.cap}>
              {selected.seats_taken} places réservées sur {selected.capacity}
              {selected.capacity > selected.seats_taken ? ` · ${selected.capacity - selected.seats_taken} libres` : ' · complet'}
            </Text>
            <ProgressBar value={selected.seats_taken} max={selected.capacity} />
          </View>

          <View style={s.stats}>
            <Stat label="réservations" value={stats ? String(stats.reservations) : dash} />
            <Stat label="présents" value={stats ? String(stats.present) : dash} sub={stats ? `sur ${stats.seats_taken}` : undefined} />
            <Stat label="payées" value={stats ? String(stats.payments_received) : dash} sub={stats ? `sur ${stats.reservations}` : undefined} />
            <Stat label="encaissé" value={stats ? formatPrice(stats.amount_paid_cents) : dash}
              sub={stats ? `sur ${formatPrice(stats.amount_due_cents)}` : undefined} />
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button variant="gold" title="Scanner les billets" onPress={() => router.push(`/admin/scanner/${selected.id}`)} />
            <Button variant="secondary" title="Liste des participants" onPress={() => router.push(`/admin/participants/${selected.id}`)} />
            <Button variant="secondary" title="Modifier la sortie" onPress={() => router.push(`/admin/sortie/${selected.id}`)} />
          </View>
          <LinkText onPress={() => router.push('/admin/sortie/nouvelle')}>Créer une nouvelle sortie</LinkText>
        </>
      ) : (
        <Button variant="gold" title="Créer une sortie" onPress={() => router.push('/admin/sortie/nouvelle')} />
      )}

      <Button variant="ghost" title="Se déconnecter" onPress={signOut} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  selector: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 2 },
  pill: {
    borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, maxWidth: 240,
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  pillText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  pillTextActive: { color: colors.onPrimary, fontFamily: fonts.medium },
  eventTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text, marginTop: 4 },
  eventMeta: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  cap: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, marginTop: spacing.sm },
  stats: {
    flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, borderRadius: 12,
    backgroundColor: colors.surface, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  statValue: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  statSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textFaint },
});
