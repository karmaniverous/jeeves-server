import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Root route — immediately redirects to /browse.
 *
 * The server-side auth gate (#253) guarantees that the SPA only loads for
 * authenticated users, so no client-side auth check is needed here.
 */
export function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/browse', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground text-sm">Loading…</div>
    </div>
  );
}
