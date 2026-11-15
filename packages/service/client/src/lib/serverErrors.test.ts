import { ServerError } from '@karmaniverous/jeeves-server-sdk';
import { describe, expect, it } from 'vitest';

import {
  errorMessage,
  isUnauthorized,
  searchErrorMessage,
  UNAUTHORIZED_MESSAGE,
} from './serverErrors';

/** A `ServerError` with `code`. */
const failure = (code: string, status = 0, message = 'server text') =>
  new ServerError({ code, status, message });

describe('errorMessage', () => {
  it("shows a server code's own message", () => {
    expect(errorMessage(failure('SERVER_CONFLICT', 409, 'File changed'))).toBe(
      'File changed',
    );
  });

  it('shows Unauthorized for SERVER_UNAUTHORIZED', () => {
    expect(errorMessage(failure('SERVER_UNAUTHORIZED', 401))).toBe(
      UNAUTHORIZED_MESSAGE,
    );
  });

  it('shows fixed texts for client-side failures', () => {
    expect(errorMessage(failure('timeout'))).toBe(
      'The server took too long to respond.',
    );
    expect(errorMessage(failure('network_error'))).toBe(
      'The server could not be reached.',
    );
    expect(errorMessage(failure('invalid_response'))).toBe(
      'The server sent an unexpected response.',
    );
  });

  it("shows other errors' messages, else the fallback", () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('boom', 'Action failed')).toBe('Action failed');
    expect(errorMessage(undefined)).toBe('Something went wrong');
  });
});

describe('isUnauthorized', () => {
  it('is true for SERVER_UNAUTHORIZED only', () => {
    expect(isUnauthorized(failure('SERVER_UNAUTHORIZED', 401))).toBe(true);
    expect(isUnauthorized(failure('SERVER_FORBIDDEN', 403))).toBe(false);
    expect(isUnauthorized(new Error('Unauthorized'))).toBe(false);
  });
});

describe('searchErrorMessage', () => {
  it.each([
    ['SERVER_WATCHER_UNAVAILABLE', 'Search service is unavailable.'],
    ['SERVER_NOT_CONFIGURED', 'Search is not configured on this server.'],
    ['SERVER_FORBIDDEN', 'You do not have permission to search.'],
    ['SERVER_INSIDER_REQUIRED', 'You do not have permission to search.'],
    ['SERVER_OUT_OF_SCOPE', 'You do not have permission to search.'],
    ['SERVER_INVALID_REQUEST', 'Invalid search query.'],
    ['invalid_request', 'Invalid search query.'],
  ])('words %s', (code, text) => {
    expect(searchErrorMessage(failure(code))).toContain(text);
  });

  it('is a generic failure otherwise', () => {
    expect(searchErrorMessage(failure('http_500', 500))).toBe(
      'Search failed. Please try again later.',
    );
    expect(searchErrorMessage(new Error('x'))).toBe(
      'Search failed. Please try again later.',
    );
  });
});
