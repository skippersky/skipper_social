const SITE_NAME = 'KiliSocial';

/**
 * Minimal SPA page meta: "<title> - KiliSocial" plus the meta description.
 * Static OG tags live in index.html; titles/descriptions update per page.
 */
export function usePageMeta(title: string, description: string): void {
  if (typeof document === 'undefined') return;
  document.title = title ? `${title} - ${SITE_NAME}` : SITE_NAME;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', description);
}