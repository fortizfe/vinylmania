import { FEED_SOURCES } from '../../src/feeds/feedSources';

function findSource(id: string) {
  const source = FEED_SOURCES.find((s) => s.id === id);
  if (!source) {
    throw new Error(`expected FEED_SOURCES to contain an entry with id "${id}"`);
  }
  return source;
}

describe('FEED_SOURCES priority configuration (spec FR-008, FR-009, FR-010, FR-012)', () => {
  it('adds MetalSucks and Louder Sound as enabled News sources', () => {
    const metalsucks = findSource('metalsucks');
    expect(metalsucks).toMatchObject({
      name: 'MetalSucks',
      feedUrl: 'https://feeds.feedburner.com/Metalsucks',
      category: 'News',
      enabled: true,
      priority: true,
    });

    const louderSound = findSource('louder-sound');
    expect(louderSound).toMatchObject({
      name: 'Louder Sound',
      feedUrl: 'https://www.loudersound.com/feeds.xml',
      category: 'News',
      enabled: true,
      priority: true,
    });
  });

  it('marks Metal Injection as a priority source, alongside MetalSucks and Louder Sound', () => {
    expect(findSource('metal-injection').priority).toBe(true);
  });

  it('contains no Metal Storm entry (spec 041 FR-001)', () => {
    const metalStormById = FEED_SOURCES.filter((s) => s.id.startsWith('metal-storm-'));
    const metalStormByName = FEED_SOURCES.filter((s) => s.name === 'Metal Storm');
    expect(metalStormById).toHaveLength(0);
    expect(metalStormByName).toHaveLength(0);
  });

  it('declares the three priority sources in Metal Injection, MetalSucks, Louder Sound order (spec FR-012)', () => {
    const priorityIds = FEED_SOURCES.filter((s) => s.priority).map((s) => s.id);
    expect(priorityIds).toEqual(['metal-injection', 'metalsucks', 'louder-sound']);
  });

  it('adds the 5 confirmed-reachable new sources as enabled, non-priority News sources (spec 041 FR-005)', () => {
    expect(findSource('heavy-mag')).toMatchObject({
      name: 'Heavy Mag',
      feedUrl: 'https://heavymag.com.au/feed/',
      category: 'News',
      enabled: true,
      priority: false,
    });
    expect(findSource('metal-underground')).toMatchObject({
      name: 'Metal Underground',
      feedUrl: 'https://feeds.feedburner.com/metalunderground',
      category: 'News',
      enabled: true,
      priority: false,
    });
    expect(findSource('heavy-metal-overload')).toMatchObject({
      name: 'Heavy Metal Overload',
      feedUrl: 'https://heavymetaloverload.com/feed/',
      category: 'News',
      enabled: true,
      priority: false,
    });
    expect(findSource('femme-metal')).toMatchObject({
      name: 'Femme Metal',
      feedUrl: 'https://femmetal.rocks/feed/',
      category: 'News',
      enabled: true,
      priority: false,
    });
    expect(findSource('metaltalk')).toMatchObject({
      name: 'MetalTalk',
      feedUrl: 'https://www.metaltalk.net/feed',
      category: 'News',
      enabled: true,
      priority: false,
    });
  });

  it('does not include Metal Blade Records — confirmed persistently unreachable (research.md §1, spec 041 FR-006)', () => {
    expect(FEED_SOURCES.find((s) => s.name === 'Metal Blade Records')).toBeUndefined();
    expect(FEED_SOURCES.some((s) => s.feedUrl.includes('metalblade.com'))).toBe(false);
  });
});
