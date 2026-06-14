import { createContext, useContext } from 'react';

export interface BrandingData {
  name: string;
  emoji: string;
  theme?: {
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
}

const DEFAULT_BRANDING: BrandingData = {
  name: 'Jeeves Server',
  emoji: '🎩',
};

export const BrandingContext = createContext<BrandingData>(DEFAULT_BRANDING);

export function useBranding(): BrandingData {
  return useContext(BrandingContext);
}
