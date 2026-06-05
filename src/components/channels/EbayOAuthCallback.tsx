/* Legacy RuName may still redirect here — forward to integrations OAuth callback. */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function EbayOAuthCallback() {
  const [searchParams] = useSearchParams();
  const [message] = useState('Completing eBay connection…');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const qs = new URLSearchParams();
    if (code) qs.set('code', code);
    if (state) qs.set('state', state);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    window.location.replace(`/api/integrations/ebay/oauth/callback${suffix}`);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
      <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 max-w-md w-full text-center space-y-4">
        <Loader2 size={40} className="animate-spin text-blue-400 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-600 dark:text-slate-200">Connecting eBay</h2>
        <p className="text-sm text-slate-400 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}
