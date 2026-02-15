import { Check, ExternalLink, Download } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { getShareLink } from '@/lib/api';

interface ShareButtonProps {
  type: 'page' | 'raw';
  path: string;
  insiderKey: string;
  expiry?: string;
}

export function ShareButton({ type, path, insiderKey, expiry }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      let expiryParam: string | undefined;
      if (expiry) {
        const match = expiry.match(/^(\d+)([mhd])$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          const unit = match[2].toLowerCase();
          const multiplier: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
          expiryParam = String(Date.now() + val * multiplier[unit]);
        }
      }

      const data = await getShareLink(insiderKey, path, expiryParam);
      if (data.url) {
        let fullUrl = window.location.origin + data.url;
        if (type === 'raw') {
          fullUrl += (fullUrl.includes('?') ? '&' : '?') + 'raw=1';
        }
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const Icon = copied ? Check : type === 'page' ? ExternalLink : Download;
  const title = type === 'page' ? 'Copy page link' : 'Copy raw link';

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-7 w-7 ${copied ? 'text-green-500' : 'text-zinc-500 hover:text-zinc-300'}`}
      title={title}
      onClick={handleClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
