import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { EventCover } from '@/components/EventCard';
import { Banner, Body, Empty, Header, Loading, Screen, styles } from '@/components/ui';
import { listPastEvents } from '@/lib/api';
import { capitalize, formatDate } from '@/lib/format';
import { useFocusData } from '@/lib/useAsync';
import { spacing } from '@/theme';

export default function Gallery() {
  const router = useRouter();
  const { data, error, loading, refreshing, refresh } = useFocusData(() => listPastEvents(30));

  return (
    <Screen header={<Header title="Galerie" subtitle="Nos sorties passées" onBack={() => router.back()} />}
      refreshing={refreshing} onRefresh={refresh}>
      {error ? <Banner message={error.message} /> : null}
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <Empty title="Bientôt des photos" message="Les photos des prochaines sorties apparaîtront ici." /> : null}
      {data?.map((e) => (
        <View key={e.id} style={{ gap: spacing.xs }}>
          <EventCover uri={e.cover_image} height={200} />
          <Text style={[styles.body, { fontWeight: '700' }]}>{e.title}</Text>
          <Body muted>{capitalize(formatDate(e.starts_at))}</Body>
        </View>
      ))}
    </Screen>
  );
}
