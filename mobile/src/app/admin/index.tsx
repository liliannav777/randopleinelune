import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { eventStatusBadge } from '@/components/EventCard';
import { Banner, Body, Button, Card, Empty, Header, InfoRow, Loading, Screen, SectionTitle, styles } from '@/components/ui';
import { adminEventStats, adminListEvents } from '@/lib/api';
import { useAdminAuth } from '@/lib/adminAuth';
import { formatPrice, formatShortDate, formatTime } from '@/lib/format';
import type { EventStats, HikeEvent } from '@/lib/types';
import { useFocusData } from '@/lib/useAsync';
import { colors, radius, spacing } from '@/theme';

function pickDefault(events: HikeEvent[]): HikeEvent | undefined {
  const now = Date.now() - 12 * 3600 * 1000; // une sortie reste « en cours » 12 h
  return events.find((e) => new Date(e.starts_at).getTime() >= now && e.status !== 'draft')
    ?? events.find((e) => new Date(e.starts_at).getTime() >= now)
    ?? events[events.length - 1];
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
      header={<Header title="Administration" subtitle="Tableau de bord" onBack={() => router.replace('/')}
        right={<Pressable onPress={() => router.push('/admin/parametres')} accessibilityLabel="Paramètres" hitSlop={10}>
          <Text style={{ color: colors.onPrimary, fontSize: 22 }}>⚙︎</Text></Pressable>} />}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {error ? <Banner message={error.message} /> : null}
      {loading && !events ? <Loading /> : null}

      {events && events.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Body muted>Sortie sélectionnée</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {events.map((e) => {
              const active = e.id === selected?.id;
              return (
                <Pressable key={e.id} onPress={() => setSelectedId(e.id)} accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1,
                    borderColor: active ? colors.secondary : colors.border, backgroundColor: active ? colors.secondary : colors.surface,
                  }}>
                  <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 13 }}>
                    {formatShortDate(e.starts_at)} · {e.title.length > 26 ? `${e.title.slice(0, 25)}…` : e.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {events?.length === 0 ? <Empty title="Aucune sortie" message="Créez votre première randonnée." /> : null}

      {selected ? (
        <>
          <Card>
            <Text style={[styles.body, { fontWeight: '700' }]}>{selected.title}</Text>
            <Body muted>{formatShortDate(selected.starts_at)} • {formatTime(selected.starts_at)} • {selected.meeting_point}</Body>
            {eventStatusBadge(selected)}
          </Card>
          <View style={{ backgroundColor: colors.placeholder, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' }}>
            <Text style={[styles.body, { fontWeight: '700' }]}>{selected.capacity} places maximum</Text>
            <Body muted>{Math.max(0, selected.capacity - selected.seats_taken)} restante(s)</Body>
          </View>
          <Card>
            <InfoRow label="Places réservées" value={stats ? String(stats.seats_taken) : '…'} />
            <InfoRow label="Réservations" value={stats ? String(stats.reservations) : '…'} />
            <InfoRow label="Présents" value={stats ? `${stats.present} / ${stats.seats_taken}` : '…'} />
            <InfoRow label="Paiements reçus" value={stats ? `${stats.payments_received} / ${stats.reservations}` : '…'} />
            <InfoRow label="Encaissé / attendu" value={stats
              ? `${formatPrice(stats.amount_paid_cents)} / ${formatPrice(stats.amount_due_cents)}` : '…'} />
          </Card>
          <Button title="Voir les participants" onPress={() => router.push(`/admin/participants/${selected.id}`)} />
          <Button title="Scanner un QR code" onPress={() => router.push(`/admin/scanner/${selected.id}`)} />
          <Button title="Modifier la randonnée" onPress={() => router.push(`/admin/sortie/${selected.id}`)} />
        </>
      ) : null}

      <SectionTitle>Gestion</SectionTitle>
      <Button variant="secondary" title="Nouvelle randonnée" onPress={() => router.push('/admin/sortie/nouvelle')} />
      <Button variant="ghost" title="Se déconnecter" onPress={signOut} />
    </Screen>
  );
}
