import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CUE_DURATION_S,
  CUE_FREQUENCY_HZ,
  CUE_GAIN,
  browserPushPermission,
  browserPushSupported,
  playNotificationCue,
  requestBrowserPushPermission,
  resetNotificationAlerts,
  showBrowserNotification
} from '../lib/notificationAlerts';

type PushImpl = typeof Notification & {
  permission: NotificationPermission;
  requestPermission?: () => Promise<NotificationPermission>;
};

function fakeNotification(permission: NotificationPermission) {
  const constructed: Array<{ title: string; body?: string }> = [];
  const impl = function (title: string, options?: NotificationOptions) {
    constructed.push({ title, body: options?.body });
  } as unknown as PushImpl;
  impl.permission = permission;
  return { impl, constructed };
}

function fakeAudio(state = 'running') {
  const oscillator = {
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  };
  const gain = { gain: { value: 1 }, connect: vi.fn() };
  const instance = {
    state,
    currentTime: 2.5,
    destination: { kind: 'destination' },
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain)
  };
  return { Ctor: vi.fn(() => instance), instance, oscillator, gain };
}

beforeEach(() => {
  resetNotificationAlerts();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetNotificationAlerts();
});

describe('browser push capability', () => {
  it('reports unsupported when the platform has no notification api', async () => {
    vi.stubGlobal('Notification', undefined);

    expect(browserPushSupported()).toBe(false);
    expect(browserPushPermission()).toBe('unsupported');
    await expect(requestBrowserPushPermission()).resolves.toBe('unsupported');
    expect(showBrowserNotification('New message', 'Amani replied')).toBe(false);
  });

  it('mirrors the live permission state', () => {
    const { impl } = fakeNotification('granted');
    vi.stubGlobal('Notification', impl);

    expect(browserPushSupported()).toBe(true);
    expect(browserPushPermission()).toBe('granted');
  });

  it('asks once and returns the browser decision', async () => {
    const { impl } = fakeNotification('default');
    const requestPermission = vi.fn().mockResolvedValue('granted' as NotificationPermission);
    impl.requestPermission = requestPermission;
    vi.stubGlobal('Notification', impl);

    await expect(requestBrowserPushPermission()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('maps a rejected permission prompt onto denied', async () => {
    const { impl } = fakeNotification('default');
    impl.requestPermission = () => Promise.reject(new Error('blocked'));
    vi.stubGlobal('Notification', impl);

    await expect(requestBrowserPushPermission()).resolves.toBe('denied');
  });

  it('reports unsupported when the api exists but cannot prompt', async () => {
    const { impl } = fakeNotification('default');
    vi.stubGlobal('Notification', impl);

    await expect(requestBrowserPushPermission()).resolves.toBe('unsupported');
  });
});

describe('showBrowserNotification', () => {
  it('mirrors the toast into the OS tray once permission is granted', () => {
    const { impl, constructed } = fakeNotification('granted');
    vi.stubGlobal('Notification', impl);

    expect(showBrowserNotification('New message', 'Amani replied')).toBe(true);
    expect(constructed).toEqual([{ title: 'New message', body: 'Amani replied' }]);
  });

  it('stays silent while permission is not granted', () => {
    const { impl, constructed } = fakeNotification('denied');
    vi.stubGlobal('Notification', impl);

    expect(showBrowserNotification('New message', 'body')).toBe(false);
    expect(constructed).toHaveLength(0);
  });

  it('swallows a constructor failure instead of breaking the toast', () => {
    const impl = function () {
      throw new Error('blocked');
    } as unknown as PushImpl;
    impl.permission = 'granted';
    vi.stubGlobal('Notification', impl);

    expect(showBrowserNotification('New message', 'body')).toBe(false);
  });
});

describe('playNotificationCue', () => {
  it('returns false when the page has no audio context', () => {
    vi.stubGlobal('AudioContext', undefined);

    expect(playNotificationCue()).toBe(false);
  });

  it('plays one short sine cue at the configured pitch and gain', () => {
    const audio = fakeAudio();
    vi.stubGlobal('AudioContext', audio.Ctor);

    expect(playNotificationCue()).toBe(true);
    expect(audio.Ctor).toHaveBeenCalledTimes(1);
    expect(audio.oscillator.frequency.value).toBe(CUE_FREQUENCY_HZ);
    expect(audio.gain.gain.value).toBe(CUE_GAIN);
    expect(audio.oscillator.connect).toHaveBeenCalledWith(audio.gain);
    expect(audio.gain.connect).toHaveBeenCalledWith(audio.instance.destination);
    expect(audio.oscillator.start).toHaveBeenCalledTimes(1);
    expect(audio.oscillator.stop).toHaveBeenCalledWith(audio.instance.currentTime + CUE_DURATION_S);
  });

  it('reuses the cached context until it closes', () => {
    const audio = fakeAudio();
    vi.stubGlobal('AudioContext', audio.Ctor);

    playNotificationCue();
    playNotificationCue();
    expect(audio.Ctor).toHaveBeenCalledTimes(1);

    audio.instance.state = 'closed';
    playNotificationCue();
    expect(audio.Ctor).toHaveBeenCalledTimes(2);
  });

  it('returns false when building the audio graph throws', () => {
    const audio = fakeAudio();
    audio.instance.createOscillator.mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.stubGlobal('AudioContext', audio.Ctor);

    expect(playNotificationCue()).toBe(false);
  });

  it('drops the cached context through the test hook', () => {
    const audio = fakeAudio();
    vi.stubGlobal('AudioContext', audio.Ctor);

    playNotificationCue();
    resetNotificationAlerts();
    playNotificationCue();

    expect(audio.Ctor).toHaveBeenCalledTimes(2);
  });
});
