/**
 * Delivery side effects for a notification: the browser push mirror and the
 * short audio cue. Both degrade silently when the platform does not offer
 * them, so the in-app toast always stays the source of truth.
 */

export const CUE_FREQUENCY_HZ = 660;
export const CUE_DURATION_S = 0.12;
export const CUE_GAIN = 0.04;

type NotificationCtor = typeof Notification;
type AudioCtor = typeof AudioContext;

function notificationCtor(): NotificationCtor | undefined {
  return (globalThis as { Notification?: NotificationCtor }).Notification;
}

function audioCtor(): AudioCtor | undefined {
  return (globalThis as { AudioContext?: AudioCtor }).AudioContext;
}

export function browserPushSupported(): boolean {
  return notificationCtor() !== undefined;
}

export function browserPushPermission(): NotificationPermission | 'unsupported' {
  const impl = notificationCtor();
  return impl ? impl.permission : 'unsupported';
}

/** Asks the browser for notification permission; never throws. */
export async function requestBrowserPushPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  const impl = notificationCtor();
  if (!impl || typeof impl.requestPermission !== 'function') return 'unsupported';
  try {
    return await impl.requestPermission();
  } catch {
    return 'denied';
  }
}

/** Mirrors an in-app toast into the OS tray when permission is granted. */
export function showBrowserNotification(title: string, body: string): boolean {
  const impl = notificationCtor();
  if (!impl || impl.permission !== 'granted') return false;
  try {
    new impl(title, { body });
    return true;
  } catch {
    return false;
  }
}

let context: AudioContext | null = null;

/** Plays one short sine cue; false when audio is unavailable or blocked. */
export function playNotificationCue(): boolean {
  const Ctor = audioCtor();
  if (!Ctor) return false;
  try {
    if (!context || context.state === 'closed') context = new Ctor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = CUE_GAIN;
    oscillator.frequency.value = CUE_FREQUENCY_HZ;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + CUE_DURATION_S);
    return true;
  } catch {
    return false;
  }
}

/** Test hook: drop the cached audio context. */
export function resetNotificationAlerts(): void {
  context = null;
}
