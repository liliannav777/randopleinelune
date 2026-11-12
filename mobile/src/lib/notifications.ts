// Notifications push (Spécifications V1 §8) : l'autorisation est demandée
// après une réservation, avec une explication, jamais au lancement.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function getPushPermission(): Promise<PushPermission> {
  if (!Device.isDevice || Platform.OS === 'web') return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  return status as PushPermission;
}

async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reservations', {
      name: 'Réservations et rappels',
      importance: AndroidImportance.HIGH,
      lightColor: '#D8B66A',
    });
  }
}

/**
 * Demande l'autorisation puis associe l'appareil aux réservations données.
 * Retourne le statut final ; un refus n'empêche jamais la réservation
 * (l'e-mail reste le canal de référence).
 */
export async function enablePushFor(accessTokens: string[]): Promise<PushPermission> {
  if (!Device.isDevice || Platform.OS === 'web') return 'unavailable';
  await ensureAndroidChannel();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return status as PushPermission;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('projectId EAS manquant (app.json > extra.eas.projectId) : push désactivé');
    return 'unavailable';
  }
  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await Promise.all(accessTokens.map((t) => registerPushToken(t, pushToken, platform)));
  return 'granted';
}
