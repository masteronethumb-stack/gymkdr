/* GYMKDR · the end of a rest, as a notification. Between sets the phone is often locked or in a
   pocket; the rest timer still says when to go. Permission is asked at the first rest, not at launch.
   With the app open, it chimes and buzzes itself, so the notification isn't shown then. */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import CH from '../ch';

let asked = false, allowed = false, pending = null, gen = 0;
const web = Platform.OS === 'web';

if (!web) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch (e) { /* notifications are optional */ }
}

async function permission() {
  if (web) return false;
  if (asked) return allowed;
  asked = true;
  try {
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('rest', { name: 'Rest timer', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 120, 250] });
    const cur = await Notifications.getPermissionsAsync();
    allowed = !!cur.granted;
    if (!allowed && cur.canAskAgain !== false) allowed = !!(await Notifications.requestPermissionsAsync()).granted;
  } catch (e) { allowed = false; }
  return allowed;
}

CH.notify = {
  async restAt(at, name) {
    const mine = ++gen;
    await drop();
    if (!(await permission()) || mine !== gen) return;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: 'Rest over', body: name ? `Time for your next set of ${name.toLowerCase()}.` : 'Time for your next set.', sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: 'rest' },
      });
      // Cancelled or replaced while it was being scheduled: take it straight back out.
      if (mine !== gen) { Notifications.cancelScheduledNotificationAsync(id).catch(() => {}); return; }
      pending = id;
    } catch (e) { pending = null; }
  },
  cancel() { gen++; return drop(); },
};
async function drop() {
  const id = pending;
  pending = null;
  if (!id || web) return;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch (e) { /* already gone */ }
}

export default CH.notify;
