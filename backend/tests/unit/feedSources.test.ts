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

  it('marks every Metal Storm entry as non-priority', () => {
    const metalStormSources = FEED_SOURCES.filter((s) => s.name === 'Metal Storm');
    expect(metalStormSources.length).toBeGreaterThan(0);
    for (const source of metalStormSources) {
      expect(source.priority).toBe(false);
    }
  });

  it('declares the three priority sources in Metal Injection, MetalSucks, Louder Sound order (spec FR-012)', () => {
    const priorityIds = FEED_SOURCES.filter((s) => s.priority).map((s) => s.id);
    expect(priorityIds).toEqual(['metal-injection', 'metalsucks', 'louder-sound']);
  });
});
