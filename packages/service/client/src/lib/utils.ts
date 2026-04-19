import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compute key age in days from a creation timestamp. */
export function computeKeyAge(keyCreatedAt: string | null | undefined): string | null {
  if (!keyCreatedAt) return null;
  return `${Math.floor((Date.now() - new Date(keyCreatedAt).getTime()) / 86_400_000)}d`;
}
