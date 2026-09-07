import { localeToStorefront } from '../../../src/adapters/streaming/storefront';

describe('localeToStorefront()', () => {
  it('maps a region-tagged explicit locale to its uppercase region', () => {
    expect(localeToStorefront('es-ES')).toBe('ES');
    expect(localeToStorefront('pt-BR')).toBe('BR');
    expect(localeToStorefront('en-US')).toBe('US');
  });

  it('maps a language-only explicit locale via the language table', () => {
    expect(localeToStorefront('es')).toBe('ES');
    expect(localeToStorefront('en')).toBe('US');
    expect(localeToStorefront('de')).toBe('DE');
  });

  it('lets an explicit locale beat the Accept-Language header', () => {
    expect(localeToStorefront('es-ES', 'en-US,en;q=0.9')).toBe('ES');
  });

  it('falls back to Accept-Language when there is no explicit locale', () => {
    expect(localeToStorefront(undefined, 'pt-BR,pt;q=0.9,en;q=0.8')).toBe('BR');
    expect(localeToStorefront(undefined, 'en-US')).toBe('US');
    expect(localeToStorefront('', 'de-DE')).toBe('DE');
  });

  it('falls back to ES for junk, empty, or unknown input', () => {
    expect(localeToStorefront('!!!')).toBe('ES');
    expect(localeToStorefront('')).toBe('ES');
    expect(localeToStorefront(undefined, undefined)).toBe('ES');
    expect(localeToStorefront('zz-ZZ')).toBe('ES');
    expect(localeToStorefront('xx')).toBe('ES');
  });
});
