import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { EventCover } from '@/components/EventCard';
import { Banner, Empty, Header, Loading, Screen } from '@/components/ui';
import { listPastEvents } from '@/lib/api';
import { capitalize, formatDate } from '@/lib/format';
import { useFocusData } from '@/lib/useAsync';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

export default function Gallery() {
  const router = useRouter();
  const { data, error, loading, refreshing, refresh } = useFocusData(() => listPastEvents(30));

  return (
    <Screen header={<Header title="Galerie" subtitle="Nos nuits passées" seed="galerie" onBack={() => router.back()} />}
      refreshing={refreshing} onRefresh={refresh}>
      {error ? <Banner message={error.message} /> : null}
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? (
        <Empty icon="images-outline" title="Bientôt des photos" message="Les photos des prochaines sorties apparaîtront ici." />
      ) : null}
      {data?.map((e) => (
        <View key={e.id} style={[s.card, shadow(2)]}>
          <EventCover uri={e.cover_image} height={230} seed={e.id} rounded={false}>
            <LinearGradient colors={['rgba(11,22,38,0)', 'rgba(11,22,38,0.85)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
            <View style={s.caption}>
              <Text style={s.date}>{capitalize(formatDate(e.starts_at))}</Text>
              <Text style={s.title}>{e.title}</Text>
            </View>
          </EventCover>
        </View>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.primary },
  caption: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 2 },
  date: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2, color: colors.accentLight, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.onPrimary },
});
