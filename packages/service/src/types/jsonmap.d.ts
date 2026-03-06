/**
 * Type declarations for karmaniverous/jsonmap package
 */

declare module '@karmaniverous/jsonmap' {
  export class JsonMap {
    constructor(map?: object, lib?: Record<string, unknown>, ignore?: string);
    transform(input: unknown): Promise<unknown>;
  }
}
