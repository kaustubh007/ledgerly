/**
 * Base class for errors that signal a programming mistake or corrupt input inside the domain
 * (mixing currencies, overflowing int64, an unknown currency code).
 *
 * Business-rule violations a user can cause ("this invoice is already paid") are not thrown;
 * they are returned as values through `Result` so the API can map them to `userErrors`.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
