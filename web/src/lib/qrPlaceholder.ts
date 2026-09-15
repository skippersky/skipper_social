/**
 * Deterministic placeholder matrix for the two-factor QR tile.
 *
 * The TOTP secret only exists once the backend issues one, so instead of
 * rendering a scannable-but-fake code we render a stable pattern and the UI
 * labels it as pending. The same seed always yields the same grid.
 */
export const QR_PLACEHOLDER_SIZE = 21;

function hashAt(seed: string, index: number): number {
  let hash = 2166136261;
  const text = seed + '#' + index;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** True cells of a square grid; finder squares are forced on like a real QR. */
export function buildQrMatrix(
  seed = 'kilisocial-pending',
  size: number = QR_PLACEHOLDER_SIZE
): boolean[] {
  const cells: boolean[] = [];
  for (let index = 0; index < size * size; index++) {
    const row = Math.floor(index / size);
    const col = index % size;
    const inFinder =
      (row < 7 && col < 7) || (row < 7 && col >= size - 7) || (row >= size - 7 && col < 7);
    cells.push(inFinder ? (row + col) % 2 === 0 : hashAt(seed, index) % 3 !== 0);
  }
  return cells;
}
