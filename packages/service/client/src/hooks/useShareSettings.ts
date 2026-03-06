/**
 * Share settings persistence (localStorage).
 */
import { useEffect, useState } from 'react';

import type { ShareSettings } from '@/lib/api';

function loadShareSettings(): ShareSettings {
  const saved = localStorage.getItem('jeeves-share-settings');
  if (saved) try { return JSON.parse(saved) as ShareSettings; } catch { /* ignore */ }
  return { expiry: localStorage.getItem('jeeves-share-expiry') ?? '', depth: 0, dirs: false };
}

export function useShareSettings() {
  const [shareSettings, setShareSettings] = useState<ShareSettings>(loadShareSettings);

  useEffect(() => {
    localStorage.setItem('jeeves-share-settings', JSON.stringify(shareSettings));
  }, [shareSettings]);

  return { shareSettings, setShareSettings };
}
