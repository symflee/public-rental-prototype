export const MAXIMUM_PUBLIC_RENTAL_BOOKMARKS = 100;
export const MAXIMUM_PUBLIC_RENTAL_LOCATION_IDENTIFIER_LENGTH = 200;

export class PublicRentalBookmarks {
  readonly values: readonly string[];

  constructor(locationIdentifiers: readonly string[] = []) {
    this.values = Object.freeze(createLocationIdentifiers(locationIdentifiers));
  }

  includes(locationIdentifier: string) {
    return this.values.includes(locationIdentifier);
  }

  toggle(locationIdentifier: string) {
    if (this.includes(locationIdentifier)) return this.remove(locationIdentifier);
    return new PublicRentalBookmarks([...this.values, locationIdentifier]);
  }

  private remove(locationIdentifier: string) {
    const remaining = this.values.filter((value) => value !== locationIdentifier);
    return new PublicRentalBookmarks(remaining);
  }
}

function createLocationIdentifiers(locationIdentifiers: readonly string[]) {
  const normalized = locationIdentifiers.map(normalizeIdentifier).filter(isSafeIdentifier);
  return [...new Set(normalized)].slice(0, MAXIMUM_PUBLIC_RENTAL_BOOKMARKS);
}

function normalizeIdentifier(locationIdentifier: string) {
  return locationIdentifier.trim();
}

function isSafeIdentifier(value: string) {
  if (value.length === 0) return false;
  if (value.length > MAXIMUM_PUBLIC_RENTAL_LOCATION_IDENTIFIER_LENGTH) return false;
  return !value.includes(",");
}
