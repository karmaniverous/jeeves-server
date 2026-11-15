/**
 * A ref that always holds the latest committed value: lets an effect or a
 * long-lived callback read current props without re-running on them.
 */
import { type RefObject, useEffect, useRef } from 'react';

/**
 * Keep `value` in a ref, updated after every commit that changes it. Call
 * it before the effects that read the ref: effects run in declaration
 * order, so they see this commit's value.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
