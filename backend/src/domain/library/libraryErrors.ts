/** The user has no Discogs connection — the library is gated (FR-003). */
export class DiscogsNotLinkedError extends Error {
  constructor() {
    super('No Discogs account is linked to this user.');
    this.name = 'DiscogsNotLinkedError';
  }
}

/** The targeted Discogs custom field was deleted by the user on discogs.com. */
export class FieldNotEditableError extends Error {
  constructor(field: string) {
    super(`The Discogs "${field}" field is not available on this collection.`);
    this.name = 'FieldNotEditableError';
  }
}
