import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useMyReservations } from '@/lib/myReservations';
import { colors, fonts } from '@/theme';

type IconPair = [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap];

function TabIcon({ icons, focused, color }: { icons: IconPair; focused: boolean; color: string }) {
  return (
    <View style={s.iconWrap}>
      <Ionicons name={focused ? icons[0] : icons[1]} size={23} color={color} />
      {focused ? <View style={s.dot} /> : null}
    </View>
  );
}

export default function TabsLayout() {
  const { reservations } = useMyReservations();
  const upcoming = reservations.filter((r) => r.status === 'confirmed' && new Date(r.event.starts_at) > new Date()).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, marginBottom: 2 },
        tabBarStyle: s.bar,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: 'Accueil',
        tabBarIcon: ({ focused, color }) => <TabIcon icons={['moon', 'moon-outline']} focused={focused} color={color} />,
      }} />
      <Tabs.Screen name="randonnees" options={{
        title: 'Randonnées',
        tabBarIcon: ({ focused, color }) => <TabIcon icons={['map', 'map-outline']} focused={focused} color={color} />,
      }} />
      <Tabs.Screen name="mes-reservations" options={{
        title: 'Mes billets',
        tabBarBadge: upcoming > 0 ? upcoming : undefined,
        tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.primary, fontFamily: fonts.bold, fontSize: 11 },
        tabBarIcon: ({ focused, color }) => <TabIcon icons={['ticket', 'ticket-outline']} focused={focused} color={color} />,
      }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6, minHeight: 62,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', bottom: -7, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
});
