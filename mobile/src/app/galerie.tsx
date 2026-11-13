import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { EventCover } from '@/components/EventCard';
import { Banner, Body, Empty, Header, LinkText, Loading, Screen, SectionTitle } from '@/components/ui';
import { listPastEvents } from '@/lib/api';
import { capitalize, formatDate } from '@/lib/format';
import { PHOTOS } from '@/lib/photos';
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
      {data?.length === 0 && PHOTOS.length === 0 ? (
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

      {data && PHOTOS.length > 0 ? (
        <>
          <SectionTitle>Le Beaujolais</SectionTitle>
          {data.length === 0 ? (
            <Body muted>Les photos de nos sorties arriveront ici. En attendant, un aperçu des paysages que nous parcourons.</Body>
          ) : null}
          {PHOTOS.map((p) => (
            <View key={p.id} style={[s.card, shadow(2)]}>
              <View style={{ height: 230 }}>
                <Image source={p.source} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={p.caption} />
                <LinearGradient colors={['rgba(11,22,38,0)', 'rgba(11,22,38,0.8)']} locations={[0.5, 1]} style={StyleSheet.absoluteFill} />
                <View style={s.caption}>
                  <Text style={s.title}>{p.caption}</Text>
                  <Text style={s.credit}>© {p.author} · {p.license}</Text>
                </View>
              </View>
            </View>
          ))}
          <LinkText icon="information-circle-outline" onPress={() => router.push('/confidentialite')}>Crédits photos</LinkText>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.primary },
  caption: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: 2 },
  date: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2, color: colors.accentLight, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.onPrimary },
  credit: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.75)' },
});
