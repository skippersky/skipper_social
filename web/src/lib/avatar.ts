/**
 * Client-side avatar preparation: square crop plus recompression so an upload
 * never exceeds the 2 MB budget, even straight from a phone camera.
 *
 * jsdom has no 2D canvas context, so the canvas step is probed first and
 * degrades to the original data URL with `compressed: false` instead of
 * hanging on an image decode that never completes.
 */

/** Hard upload budget required by the settings spec. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** Square edge length of the stored avatar. */
export const AVATAR_OUTPUT_SIZE = 512;
export const AVATAR_JPEG_QUALITY = 0.82;

export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export type AvatarErrorCode = 'empty' | 'unsupported' | 'read' | 'tooLarge';

export class AvatarError extends Error {
  constructor(public readonly code: AvatarErrorCode, message: string) {
    super(message);
    this.name = 'AvatarError';
  }
}

export interface PreparedAvatar {
  /** Data URL ready to store locally or upload. */
  dataUrl: string;
  bytes: number;
  /** False when the browser could not canvas-encode (e.g. jsdom). */
  compressed: boolean;
}

export function isSupportedImage(file: Pick<File, 'type'>): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(file.type);
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new AvatarError('read', 'could not read the image'));
    reader.readAsDataURL(file);
  });
}

/** Approximate decoded size of the base64 payload of a data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const index = dataUrl.indexOf(',');
  const base64 = index === -1 ? '' : dataUrl.slice(index + 1);
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/** Returns a sized canvas, or null when no 2D context exists (jsdom). */
export function createSquareCanvas(size: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas.getContext('2d') ? canvas : null;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new AvatarError('read', 'could not decode the image'));
    image.src = dataUrl;
  });
}

/**
 * Centre-crops to a square and re-encodes as JPEG. Returns null when canvas
 * encoding is unavailable so callers fall back to the untouched source image.
 */
export async function cropToSquareDataUrl(
  dataUrl: string,
  size: number = AVATAR_OUTPUT_SIZE,
  quality: number = AVATAR_JPEG_QUALITY
): Promise<string | null> {
  const canvas = createSquareCanvas(size);
  if (!canvas) return null;
  let image: HTMLImageElement;
  try {
    image = await loadImage(dataUrl);
  } catch {
    return null;
  }
  const context = canvas.getContext('2d');
  if (!context) return null;
  const width = image.width || size;
  const height = image.height || size;
  const edge = Math.min(width, height);
  context.drawImage(image, (width - edge) / 2, (height - edge) / 2, edge, edge, 0, 0, size, size);
  const encoded = canvas.toDataURL('image/jpeg', quality);
  return encoded.startsWith('data:image') ? encoded : null;
}

/** Reads, crops and compresses one picked file into an upload-ready data URL. */
export async function prepareAvatar(
  file: File,
  size: number = AVATAR_OUTPUT_SIZE
): Promise<PreparedAvatar> {
  if (!file || file.size === 0) throw new AvatarError('empty', 'the selected file is empty');
  if (!isSupportedImage(file)) {
    throw new AvatarError('unsupported', 'unsupported image type ' + file.type);
  }
  const original = await fileToDataUrl(file);
  const cropped = await cropToSquareDataUrl(original, size);
  const dataUrl = cropped ?? original;
  const bytes = dataUrlBytes(dataUrl);
  if (bytes > MAX_AVATAR_BYTES) {
    throw new AvatarError('tooLarge', 'image still exceeds the size budget');
  }
  return { dataUrl, bytes, compressed: cropped !== null };
}

/** Maps a preparation failure to the toast copy key. */
export function avatarErrorI18nKey(error: unknown): string {
  if (error instanceof AvatarError) {
    if (error.code === 'unsupported') return 'settings.avatarUnsupported';
    if (error.code === 'tooLarge') return 'settings.avatarTooLarge';
    if (error.code === 'empty') return 'settings.avatarEmpty';
  }
  return 'settings.avatarFailed';
}
