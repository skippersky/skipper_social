import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AVATAR_JPEG_QUALITY,
  AVATAR_OUTPUT_SIZE,
  AvatarError,
  MAX_AVATAR_BYTES,
  SUPPORTED_IMAGE_TYPES,
  avatarErrorI18nKey,
  createSquareCanvas,
  cropToSquareDataUrl,
  dataUrlBytes,
  fileToDataUrl,
  isSupportedImage,
  prepareAvatar
} from '../lib/avatar';
import {
  THEME_AVAILABLE_MODES,
  THEME_MODES,
  THEME_STORAGE_KEY,
  applyTheme,
  initTheme,
  isThemeAvailable,
  isThemeMode,
  prefersDarkScheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  watchSystemTheme
} from '../lib/theme';
import { QR_PLACEHOLDER_SIZE, buildQrMatrix } from '../lib/qrPlaceholder';
import type { ResolvedTheme } from '../types';

/**
 * jsdom has no media query engine, so each case swaps in a stub and always
 * restores the original before the next one runs. Pass null to remove it.
 */
function withMatchMedia(query: unknown, run: () => void): void {
  const original = window.matchMedia;
  Object.defineProperty(window, 'matchMedia', {
    value: query === null ? undefined : () => query,
    writable: true,
    configurable: true
  });
  try {
    run();
  } finally {
    Object.defineProperty(window, 'matchMedia', {
      value: original,
      writable: true,
      configurable: true
    });
  }
}

function modernQuery(matches: boolean): {
  matches: boolean;
  listeners: Array<() => void>;
  addEventListener: (event: string, listener: () => void) => void;
  removeEventListener: (event: string, listener: () => void) => void;
} {
  const listeners: Array<() => void> = [];
  return {
    matches,
    listeners,
    addEventListener: (_event: string, listener: () => void) => {
      listeners.push(listener);
    },
    removeEventListener: (_event: string, listener: () => void) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    }
  };
}

function legacyQuery(matches: boolean): {
  matches: boolean;
  added: Array<() => void>;
  removed: Array<() => void>;
  addListener: (listener: () => void) => void;
  removeListener: (listener: () => void) => void;
} {
  const added: Array<() => void> = [];
  const removed: Array<() => void> = [];
  return {
    matches,
    added,
    removed,
    addListener: (listener: () => void) => {
      added.push(listener);
    },
    removeListener: (listener: () => void) => {
      removed.push(listener);
    }
  };
}

function pngFile(name: string, bytes: number): File {
  return new File([new Uint8Array(bytes).fill(7)], name, { type: 'image/png' });
}

/**
 * jsdom logs a "not implemented" error for getContext, which would drown the
 * suite output. The avatar helpers only care that no 2d context exists, so the
 * probe is answered directly and restored after every case.
 */
const canvasPrototype = HTMLCanvasElement.prototype as unknown as {
  getContext: () => unknown;
};
const originalGetContext = canvasPrototype.getContext;

beforeEach(() => {
  canvasPrototype.getContext = () => null;
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  canvasPrototype.getContext = originalGetContext;
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme mode table', () => {
  it('offers three modes but only paints two today', () => {
    expect(THEME_MODES).toEqual(['light', 'dark', 'system']);
    expect(THEME_AVAILABLE_MODES).toEqual(['light', 'system']);
    expect(THEME_STORAGE_KEY).toBe('ks-theme');
    expect(isThemeAvailable('dark')).toBe(false);
    expect(isThemeAvailable('light')).toBe(true);
    expect(isThemeAvailable('system')).toBe(true);
  });

  it('guards unknown values', () => {
    expect(isThemeMode('light')).toBe(true);
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('system')).toBe(true);
    expect(isThemeMode('neon')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
    expect(isThemeMode(undefined)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('collapses system onto the OS palette', () => {
    expect(resolveTheme('system', true)).toBe<ResolvedTheme>('dark');
    expect(resolveTheme('system', false)).toBe<ResolvedTheme>('light');
  });

  it('honours an explicit choice', () => {
    expect(resolveTheme('light', true)).toBe<ResolvedTheme>('light');
    expect(resolveTheme('dark', false)).toBe<ResolvedTheme>('dark');
  });

  it('reads the OS preference through the media query api', () => {
    withMatchMedia({ matches: true }, () => expect(prefersDarkScheme()).toBe(true));
    withMatchMedia({ matches: false }, () => expect(prefersDarkScheme()).toBe(false));
  });

  it('assumes a light OS when no media query api exists', () => {
    withMatchMedia(null, () => {
      expect(window.matchMedia).toBeUndefined();
      expect(prefersDarkScheme()).toBe(false);
      expect(resolveTheme('system')).toBe<ResolvedTheme>('light');
    });
  });
});

describe('theme persistence', () => {
  it('falls back to light for a missing or unknown stored value', () => {
    expect(readStoredTheme()).toBe('light');
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readStoredTheme()).toBe('light');
  });

  it('round trips a stored mode', () => {
    storeTheme('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(readStoredTheme()).toBe('system');
  });

  it('swallows a storage backend that refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => storeTheme('dark')).not.toThrow();
  });

  it('swallows a storage backend that refuses the read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readStoredTheme()).toBe('light');
  });

  it('paints the resolved palette onto the document element', () => {
    const following: ResolvedTheme = applyTheme('system');
    expect(following).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');

    const pinned: ResolvedTheme = applyTheme('dark');
    expect(pinned).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('re-applies the stored choice during bootstrap', () => {
    storeTheme('dark');

    expect(initTheme()).toBe<ResolvedTheme>('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('watchSystemTheme', () => {
  it('follows OS changes only while the stored mode is system', () => {
    const query = modernQuery(true);
    const seen: ResolvedTheme[] = [];

    withMatchMedia(query, () => {
      storeTheme('system');
      const unsubscribe = watchSystemTheme((resolved) => seen.push(resolved));
      expect(query.listeners).toHaveLength(1);

      query.listeners[0]();
      expect(seen).toEqual<ResolvedTheme[]>(['dark']);

      /* a pinned choice ignores the OS from then on */
      storeTheme('light');
      query.listeners[0]();
      expect(seen).toEqual<ResolvedTheme[]>(['dark']);

      unsubscribe();
      expect(query.listeners).toHaveLength(0);
    });
  });

  it('falls back to the legacy listener api', () => {
    const query = legacyQuery(false);
    const seen: ResolvedTheme[] = [];

    withMatchMedia(query, () => {
      storeTheme('system');
      const unsubscribe = watchSystemTheme((resolved) => seen.push(resolved));
      expect(query.added).toHaveLength(1);

      query.added[0]();
      expect(seen).toEqual<ResolvedTheme[]>(['light']);

      unsubscribe();
      expect(query.removed).toHaveLength(1);
    });
  });

  it('is a no-op without a media query api', () => {
    withMatchMedia(null, () => {
      const unsubscribe = watchSystemTheme(() => {
        throw new Error('should never fire');
      });

      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});

describe('buildQrMatrix', () => {
  it('renders the default 21 by 21 grid', () => {
    expect(QR_PLACEHOLDER_SIZE).toBe(21);

    const cells = buildQrMatrix();

    expect(cells).toHaveLength(QR_PLACEHOLDER_SIZE * QR_PLACEHOLDER_SIZE);
    expect(cells.every((cell) => typeof cell === 'boolean')).toBe(true);
    /* the pending seed is what the security tab uses before a real secret */
    expect(cells).toEqual(buildQrMatrix('kilisocial-pending'));
  });

  it('is deterministic for a seed and changes with it', () => {
    expect(buildQrMatrix('secret-a')).toEqual(buildQrMatrix('secret-a'));
    expect(buildQrMatrix('secret-a')).not.toEqual(buildQrMatrix('secret-b'));
  });

  it('honours a custom size', () => {
    expect(buildQrMatrix('x', 5)).toHaveLength(25);
    expect(buildQrMatrix('x', 0)).toEqual([]);
  });

  it('forces the three finder squares like a real code', () => {
    const size = 9;
    const cells = buildQrMatrix('finder', size);
    const at = (row: number, col: number): boolean => cells[row * size + col];

    expect(at(0, 0)).toBe(true);
    expect(at(0, 1)).toBe(false);
    /* top right and bottom left finders keep the same checker pattern */
    expect(at(0, size - 7)).toBe(true);
    expect(at(size - 7, 0)).toBe(true);
    expect(at(1, size - 7)).toBe(false);
    /* the payload area still mixes both states */
    expect(cells.slice(8 * size, 9 * size)).toContain(true);
    expect(cells.slice(8 * size, 9 * size)).toContain(false);
  });
});

describe('avatar budgets', () => {
  it('publishes the upload contract', () => {
    expect(MAX_AVATAR_BYTES).toBe(2 * 1024 * 1024);
    expect(AVATAR_OUTPUT_SIZE).toBe(512);
    expect(AVATAR_JPEG_QUALITY).toBeCloseTo(0.82);
    expect(SUPPORTED_IMAGE_TYPES).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif'
    ]);
  });

  it('recognises supported image types', () => {
    expect(isSupportedImage({ type: 'image/png' })).toBe(true);
    expect(isSupportedImage({ type: 'image/jpeg' })).toBe(true);
    expect(isSupportedImage({ type: 'image/webp' })).toBe(true);
    expect(isSupportedImage({ type: 'text/plain' })).toBe(false);
    expect(isSupportedImage({ type: '' })).toBe(false);
  });
});

describe('dataUrlBytes', () => {
  it('approximates the decoded payload size', () => {
    expect(dataUrlBytes('data:image/png;base64,QUJD')).toBe(3);
    expect(dataUrlBytes('data:image/png;base64,QUJD=')).toBe(2);
    /* two padding chars still leave a two byte approximation */
    expect(dataUrlBytes('data:image/png;base64,QUJD==')).toBe(2);
  });

  it('returns zero for an empty or commaless value', () => {
    expect(dataUrlBytes('data:image/png;base64,')).toBe(0);
    expect(dataUrlBytes('not-a-data-url')).toBe(0);
    expect(dataUrlBytes('')).toBe(0);
  });
});

describe('canvas probing', () => {
  it('reports no 2d context under jsdom', () => {
    expect(createSquareCanvas(64)).toBeNull();
  });

  it('skips cropping when encoding is unavailable', async () => {
    await expect(cropToSquareDataUrl('data:image/png;base64,QUJD')).resolves.toBeNull();
  });
});

describe('fileToDataUrl', () => {
  it('reads a file into a data url', async () => {
    const url = await fileToDataUrl(pngFile('a.png', 32));

    expect(url.startsWith('data:')).toBe(true);
    expect(dataUrlBytes(url)).toBe(32);
  });
});

describe('prepareAvatar', () => {
  it('rejects an empty selection', async () => {
    const empty = new File([], 'empty.png', { type: 'image/png' });

    await expect(prepareAvatar(empty)).rejects.toMatchObject({
      name: 'AvatarError',
      code: 'empty'
    });
  });

  it('rejects an unsupported file type', async () => {
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    await expect(prepareAvatar(text)).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('keeps the source image when the canvas cannot encode', async () => {
    const prepared = await prepareAvatar(pngFile('avatar.png', 4096));

    expect(prepared.compressed).toBe(false);
    expect(prepared.bytes).toBe(4096);
    expect(prepared.dataUrl.startsWith('data:')).toBe(true);
  });

  it('accepts a custom output size', async () => {
    const prepared = await prepareAvatar(pngFile('small.png', 64), 128);

    expect(prepared.bytes).toBe(64);
  });

  it('rejects a payload that still exceeds the budget', async () => {
    const oversized = new File([new Uint8Array(MAX_AVATAR_BYTES + 1024)], 'huge.png', {
      type: 'image/png'
    });

    await expect(prepareAvatar(oversized)).rejects.toMatchObject({ code: 'tooLarge' });
  });
});

describe('avatarErrorI18nKey', () => {
  it('maps each known failure onto its toast key', () => {
    expect(avatarErrorI18nKey(new AvatarError('unsupported', 'x'))).toBe(
      'settings.avatarUnsupported'
    );
    expect(avatarErrorI18nKey(new AvatarError('tooLarge', 'x'))).toBe('settings.avatarTooLarge');
    expect(avatarErrorI18nKey(new AvatarError('empty', 'x'))).toBe('settings.avatarEmpty');
  });

  it('falls back to the generic key', () => {
    expect(avatarErrorI18nKey(new AvatarError('read', 'x'))).toBe('settings.avatarFailed');
    expect(avatarErrorI18nKey(new Error('boom'))).toBe('settings.avatarFailed');
    expect(avatarErrorI18nKey('boom')).toBe('settings.avatarFailed');
  });

  it('keeps the failure readable on the thrown instance', () => {
    const error = new AvatarError('read', 'could not decode');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AvatarError');
    expect(error.code).toBe('read');
    expect(error.message).toBe('could not decode');
  });
});
