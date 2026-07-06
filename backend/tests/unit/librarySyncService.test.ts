import type { CollectionInstance } from '../../src/discogs/collection/collectionTypes';
import type { DiscogsConnection } from '../../src/discogs/oauth/types';
import type { LibraryEntry } from '../../src/library/types';

jest.mock('../../src/discogs/collection/collectionClient');
jest.mock('../../src/discogs/oauth/discogsOauthService');
jest.mock('../../src/library/libraryService');
jest.mock('../../src/cache/redisClient', () => ({ getRedisClient: () => null }));

import * as collectionClient from '../../src/discogs/collection/collectionClient';
import * as oauthService from '../../src/discogs/oauth/discogsOauthService';
import * as libraryService from '../../src/library/libraryService';
import { DiscogsNotLinkedError, syncLibrary } from '../../src/library/librarySyncService';
import { DiscogsUnavailableError } from '../../src/discogs/discogsErrors';

const mockedCollection = jest.mocked(collectionClient);
const mockedOauth = jest.mocked(oauthService);
const mockedLibrary = jest.mocked(libraryService);

const UID = 'user-1';

function connection(overrides: Partial<DiscogsConnection> = {}): DiscogsConnection {
  return {
    uid: UID,
    discogsUsername: 'collector',
    discogsUserId: 9,
    accessToken: 'at',
    accessTokenSecret: 'as',
    linkedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function instance(releaseId: number, overrides: Partial<CollectionInstance> = {}): CollectionInstance {
  return {
    releaseId,
    instanceId: releaseId * 10,
    folderId: 1,
    rating: 0,
    mediaCondition: null,
    sleeveCondition: null,
    notes: null,
    dateAdded: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function entry(id: string, releaseId: number, overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    id,
    discogsReleaseId: releaseId,
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockedOauth.getConnection.mockResolvedValue(connection());
  mockedOauth.markInitialLibrarySync.mockResolvedValue(undefined);
  mockedCollection.listAllInstances.mockResolvedValue([]);
  mockedCollection.getFieldMap.mockResolvedValue({
    mediaConditionFieldId: 1,
    sleeveConditionFieldId: 2,
    notesFieldId: 3,
  });
  mockedCollection.addReleaseToCollection.mockResolvedValue({ instanceId: 900, folderId: 1 });
  mockedCollection.setFieldValue.mockResolvedValue(undefined);
  mockedLibrary.listAllEntries.mockResolvedValue([]);
  mockedLibrary.createEntry.mockImplementation(async (_uid, input) =>
    entry('new-entry', input.discogsReleaseId, {
      discogsInstanceId: input.discogsInstanceId,
      discogsFolderId: input.discogsFolderId,
    }),
  );
  mockedLibrary.updateEntryInstance.mockResolvedValue(undefined);
  mockedLibrary.clearLegacyFields.mockResolvedValue(undefined);
  mockedLibrary.deleteEntry.mockResolvedValue(true);
});

describe('syncLibrary: gating', () => {
  it('throws DiscogsNotLinkedError when the user has no connection', async () => {
    mockedOauth.getConnection.mockResolvedValue(null);

    await expect(syncLibrary(UID)).rejects.toBeInstanceOf(DiscogsNotLinkedError);
    expect(mockedCollection.listAllInstances).not.toHaveBeenCalled();
  });

  it('propagates a collection listing failure without touching the mirror', async () => {
    mockedCollection.listAllInstances.mockRejectedValue(new DiscogsUnavailableError());

    await expect(syncLibrary(UID)).rejects.toBeInstanceOf(DiscogsUnavailableError);
    expect(mockedLibrary.createEntry).not.toHaveBeenCalled();
    expect(mockedLibrary.deleteEntry).not.toHaveBeenCalled();
  });
});

describe('syncLibrary: first-sync mode (no initialLibrarySyncAt)', () => {
  it('pushes Firestore-only entries to Discogs and records the returned instance', async () => {
    mockedLibrary.listAllEntries.mockResolvedValue([entry('e1', 55)]);

    const result = await syncLibrary(UID);

    expect(mockedCollection.addReleaseToCollection).toHaveBeenCalledWith(
      expect.objectContaining({ uid: UID }),
      55,
    );
    expect(mockedLibrary.updateEntryInstance).toHaveBeenCalledWith(UID, 'e1', {
      discogsInstanceId: 900,
      discogsFolderId: 1,
    });
    expect(mockedLibrary.deleteEntry).not.toHaveBeenCalled();
    expect(result.failures).toBe(0);
    expect(mockedOauth.markInitialLibrarySync).toHaveBeenCalledWith(UID);
  });

  it('migrates legacy notes and a mappable condition, then clears the legacy fields', async () => {
    mockedLibrary.listAllEntries.mockResolvedValue([
      entry('e1', 55, { legacyCondition: 'Near Mint', legacyNotes: 'Bought at a fair' }),
    ]);

    await syncLibrary(UID);

    // Condition mapped onto the Media Condition field (id 1) of the new instance.
    expect(mockedCollection.setFieldValue).toHaveBeenCalledWith(
      expect.anything(),
      { folderId: 1, releaseId: 55, instanceId: 900 },
      1,
      'Near Mint (NM or M-)',
    );
    // Notes onto the Notes field (id 3).
    expect(mockedCollection.setFieldValue).toHaveBeenCalledWith(
      expect.anything(),
      { folderId: 1, releaseId: 55, instanceId: 900 },
      3,
      'Bought at a fair',
    );
    expect(mockedLibrary.clearLegacyFields).toHaveBeenCalledWith(UID, 'e1');
  });

  it('preserves an unmappable condition verbatim inside the migrated notes', async () => {
    mockedLibrary.listAllEntries.mockResolvedValue([
      entry('e1', 55, { legacyCondition: 'Sleeve torn but plays fine', legacyNotes: 'My note' }),
    ]);

    await syncLibrary(UID);

    const notesWrites = mockedCollection.setFieldValue.mock.calls.filter(([, , fieldId]) => fieldId === 3);
    expect(notesWrites).toHaveLength(1);
    expect(notesWrites[0][3]).toContain('My note');
    expect(notesWrites[0][3]).toContain('Condition: Sleeve torn but plays fine');
    // No media-condition write for an unmappable value.
    expect(
      mockedCollection.setFieldValue.mock.calls.some(([, , fieldId]) => fieldId === 1),
    ).toBe(false);
    expect(mockedLibrary.clearLegacyFields).toHaveBeenCalledWith(UID, 'e1');
  });

  it('migrates legacy data onto an existing matching instance without re-adding it', async () => {
    mockedCollection.listAllInstances.mockResolvedValue([instance(55, { instanceId: 12, folderId: 4 })]);
    mockedLibrary.listAllEntries.mockResolvedValue([
      entry('e1', 55, { legacyNotes: 'Keep me' }),
    ]);

    await syncLibrary(UID);

    expect(mockedCollection.addReleaseToCollection).not.toHaveBeenCalled();
    expect(mockedCollection.setFieldValue).toHaveBeenCalledWith(
      expect.anything(),
      { folderId: 4, releaseId: 55, instanceId: 12 },
      3,
      'Keep me',
    );
    expect(mockedLibrary.updateEntryInstance).toHaveBeenCalledWith(UID, 'e1', {
      discogsInstanceId: 12,
      discogsFolderId: 4,
    });
  });

  it('keeps legacy fields and does not set the flag when a per-entry write fails', async () => {
    mockedLibrary.listAllEntries.mockResolvedValue([
      entry('e1', 55, { legacyNotes: 'precious' }),
      entry('e2', 66),
    ]);
    mockedCollection.addReleaseToCollection
      .mockRejectedValueOnce(new DiscogsUnavailableError())
      .mockResolvedValueOnce({ instanceId: 901, folderId: 1 });

    const result = await syncLibrary(UID);

    expect(result.failures).toBe(1);
    expect(mockedLibrary.clearLegacyFields).not.toHaveBeenCalledWith(UID, 'e1');
    expect(mockedOauth.markInitialLibrarySync).not.toHaveBeenCalled();
    // The healthy entry still completed.
    expect(mockedLibrary.updateEntryInstance).toHaveBeenCalledWith(UID, 'e2', {
      discogsInstanceId: 901,
      discogsFolderId: 1,
    });
  });

  it('does not clear legacy fields when the migration write itself fails', async () => {
    mockedCollection.listAllInstances.mockResolvedValue([instance(55, { instanceId: 12 })]);
    mockedLibrary.listAllEntries.mockResolvedValue([entry('e1', 55, { legacyNotes: 'precious' })]);
    mockedCollection.setFieldValue.mockRejectedValue(new DiscogsUnavailableError());

    const result = await syncLibrary(UID);

    expect(result.failures).toBe(1);
    expect(mockedLibrary.clearLegacyFields).not.toHaveBeenCalled();
    expect(mockedOauth.markInitialLibrarySync).not.toHaveBeenCalled();
  });
});

describe('syncLibrary: mirror mode (initialLibrarySyncAt set)', () => {
  beforeEach(() => {
    mockedOauth.getConnection.mockResolvedValue(
      connection({ initialLibrarySyncAt: '2026-07-02T00:00:00.000Z' }),
    );
  });

  it('creates entries for Discogs-only instances using their date_added', async () => {
    mockedCollection.listAllInstances.mockResolvedValue([
      instance(77, { instanceId: 71, dateAdded: '2026-03-04T05:06:07.000Z' }),
    ]);

    await syncLibrary(UID);

    expect(mockedLibrary.createEntry).toHaveBeenCalledWith(UID, {
      discogsReleaseId: 77,
      discogsInstanceId: 71,
      discogsFolderId: 1,
      addedAt: new Date('2026-03-04T05:06:07.000Z'),
    });
  });

  it('deletes Firestore-only entries instead of re-adding them to Discogs', async () => {
    mockedLibrary.listAllEntries.mockResolvedValue([
      entry('e1', 55, { discogsInstanceId: 550, discogsFolderId: 1 }),
    ]);

    await syncLibrary(UID);

    expect(mockedCollection.addReleaseToCollection).not.toHaveBeenCalled();
    expect(mockedLibrary.deleteEntry).toHaveBeenCalledWith(UID, 'e1');
  });

  it('manages the lowest instance_id when a release has several instances', async () => {
    mockedCollection.listAllInstances.mockResolvedValue([
      instance(55, { instanceId: 300, folderId: 2 }),
      instance(55, { instanceId: 12, folderId: 4 }),
    ]);
    mockedLibrary.listAllEntries.mockResolvedValue([entry('e1', 55, { discogsInstanceId: 300 })]);

    await syncLibrary(UID);

    expect(mockedLibrary.updateEntryInstance).toHaveBeenCalledWith(UID, 'e1', {
      discogsInstanceId: 12,
      discogsFolderId: 4,
    });
    expect(mockedLibrary.deleteEntry).not.toHaveBeenCalled();
  });

  it('leaves an in-sync mirror untouched and never re-marks the first sync', async () => {
    mockedCollection.listAllInstances.mockResolvedValue([instance(55, { instanceId: 550 })]);
    mockedLibrary.listAllEntries.mockResolvedValue([
      entry('e1', 55, { discogsInstanceId: 550, discogsFolderId: 1 }),
    ]);

    const result = await syncLibrary(UID);

    expect(mockedLibrary.createEntry).not.toHaveBeenCalled();
    expect(mockedLibrary.deleteEntry).not.toHaveBeenCalled();
    expect(mockedLibrary.updateEntryInstance).not.toHaveBeenCalled();
    expect(mockedOauth.markInitialLibrarySync).not.toHaveBeenCalled();
    expect(result).toMatchObject({ added: 0, removed: 0, failures: 0 });
  });
});
