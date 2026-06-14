import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BrandingContext, DEFAULT_BRANDING, type BrandingData } from './BrandingContext';

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>(DEFAULT_BRANDING);

  useEffect(() => {
    fetch('/status')
      .then((r) => (r.ok ? (r.json() as Promise<{ health?: { branding?: BrandingData } }>) : null))
      .then((data) => {
        const b = data?.health?.branding;
        if (b) setBranding({ ...DEFAULT_BRANDING, ...b });
      })
      .catch(() => {});
  }, []);

  // Dynamic <title>
  useEffect(() => {
    document.title = branding.name;
  }, [branding.name]);

  // Dynamic CSS variable injection for theme overrides
  useEffect(() => {
    const id = 'jeeves-branding-theme';
    let style = document.getElementById(id) as HTMLStyleElement | null;

    const lightVars = branding.theme?.light;
    const darkVars = branding.theme?.dark;

    if (!lightVars && !darkVars) {
      // Remove injected style if no theme overrides
      if (style) style.remove();
      return;
    }

    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }

    const lines: string[] = [];
    if (lightVars && Object.keys(lightVars).length > 0) {
      const vars = Object.entries(lightVars)
        .map(([k, v]) => `  --${k}: ${v};`)
        .join('\n');
      lines.push(`:root {\n${vars}\n}`);
    }
    if (darkVars && Object.keys(darkVars).length > 0) {
      const vars = Object.entries(darkVars)
        .map(([k, v]) => `  --${k}: ${v};`)
        .join('\n');
      lines.push(`.dark {\n${vars}\n}`);
    }

    style.textContent = lines.join('\n');

    return () => {
      style?.remove();
    };
  }, [branding.theme]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}
