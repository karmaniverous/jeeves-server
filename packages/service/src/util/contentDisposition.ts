/**
 * `Content-Disposition: attachment` with a file name any client reads
 * (RFC 6266): an ASCII `filename` fallback and the exact UTF-8 name in
 * `filename*` (RFC 5987). Pure.
 *
 * @packageDocumentation
 */

/**
 * The ASCII fallback of a file name: printable ASCII kept, everything else
 * (non-ASCII, control characters, `"` and `\`) replaced by `_`.
 *
 * @param name - The file name.
 * @returns The fallback.
 */
export function asciiFileName(name: string): string {
  return name.replace(/[^\x20-\x7e]|["\\]/gu, '_');
}

/**
 * A file name percent-encoded for `filename*` (RFC 5987 `attr-char`s left
 * as they are).
 *
 * @param name - The file name.
 * @returns The encoded name.
 */
export function encodeRfc5987(name: string): string {
  return encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * `attachment; filename="<ASCII fallback>"; filename*=UTF-8''<encoded>`.
 *
 * @param name - The file name.
 * @returns The header value.
 */
export function attachmentDisposition(name: string): string {
  return `attachment; filename="${asciiFileName(name)}"; filename*=UTF-8''${encodeRfc5987(name)}`;
}
