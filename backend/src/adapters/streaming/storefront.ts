/**
 * Locale → iTunes storefront (country code) mapping (research.md §4).
 *
 * Adapter layer: this is request-shape translation for the Apple Music
 * integration, not domain logic. No new user data — the storefront is derived
 * per request from the browser locale, with a fixed `ES` fallback.
 */

import type { Storefront } from '../../domain/streaming/types';

/** Fallback when nothing usable can be derived (spec Clarifications). */
const DEFAULT_STOREFRONT: Storefront = 'ES';

/**
 * Language subtag → country, for language-only tags (`es`, `en`). Small and
 * deliberately conservative (research.md §4); extend as real locales appear.
 */
const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  es: 'ES',
  en: 'US',
  pt: 'PT',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
  nl: 'NL',
  ja: 'JP',
};

/**
 * ISO-3166-1 alpha-2 codes that iTunes/Apple Music actually operates a
 * storefront for. An unrecognised region subtag is not trusted — it falls
 * through to the language table, then to `ES`.
 */
const KNOWN_STOREFRONTS = new Set<string>([
  'AE',
  'AR',
  'AT',
  'AU',
  'BE',
  'BG',
  'BO',
  'BR',
  'CA',
  'CH',
  'CL',
  'CO',
  'CR',
  'CY',
  'CZ',
  'DE',
  'DK',
  'DO',
  'EC',
  'EE',
  'EG',
  'ES',
  'FI',
  'FR',
  'GB',
  'GR',
  'GT',
  'HK',
  'HN',
  'HR',
  'HU',
  'ID',
  'IE',
  'IL',
  'IN',
  'IS',
  'IT',
  'JP',
  'KR',
  'LT',
  'LU',
  'LV',
  'MT',
  'MX',
  'MY',
  'NG',
  'NI',
  'NL',
  'NO',
  'NZ',
  'PA',
  'PE',
  'PH',
  'PL',
  'PT',
  'PY',
  'RO',
  'RU',
  'SA',
  'SE',
  'SG',
  'SI',
  'SK',
  'SV',
  'TH',
  'TR',
  'TW',
  'UA',
  'US',
  'UY',
  'VE',
  'VN',
  'ZA',
]);

function storefrontFromTag(tag: string | undefined): Storefront | undefined {
  if (!tag || typeof tag !== 'string') {
    return undefined;
  }

  // First language tag, without its `;q=` weight.
  const first = tag.split(',')[0]?.split(';')[0]?.trim();
  if (!first) {
    return undefined;
  }

  const [languageRaw, regionRaw] = first.split(/[-_]/);
  const language = languageRaw?.toLowerCase();
  const region = regionRaw?.toUpperCase();

  if (region && KNOWN_STOREFRONTS.has(region)) {
    return region;
  }
  if (language && LANGUAGE_TO_COUNTRY[language]) {
    return LANGUAGE_TO_COUNTRY[language];
  }
  return undefined;
}

/**
 * Resolves the storefront to resolve links against. An explicit `locale`
 * query param wins; otherwise the request `Accept-Language` header is used;
 * otherwise `ES`.
 */
export function localeToStorefront(
  explicitLocale?: string,
  acceptLanguage?: string,
): Storefront {
  return (
    storefrontFromTag(explicitLocale) ??
    storefrontFromTag(acceptLanguage) ??
    DEFAULT_STOREFRONT
  );
}
