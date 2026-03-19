/* ─── EbayOAuthCallback ────────────────────────────────────
 *  Handles the redirect from eBay OAuth consent screen.
 *  Reads ?code=...&state=... and forwards to backend.
 * ────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function EbayOAuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Connecting to eBay...');

    useEffect(() => {
        const code = searchParams.get('code');
        const state = searchParams.get('state') ?? 'connect:system';

        if (!code) {
            setStatus('error');
            setMessage('No authorization code received from eBay.');
            return;
        }

        (async () => {
            try {
                const res = await fetch(
                    `/api/channels/ebay/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
                );
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message ?? `Error ${res.status}`);
                }
                const data = await res.json();
                setStatus('success');
                setMessage(`eBay account connected successfully! (${data.accountName ?? data.id?.slice(0, 8)})`);

                // Redirect to settings/channels after 2s
                setTimeout(() => navigate('/settings', { replace: true }), 2000);
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message ?? 'Failed to connect eBay account.');
            }
        })();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md w-full text-center space-y-4">
                {status === 'loading' && (
                    <>
                        <Loader2 size={40} className="animate-spin text-blue-400 mx-auto" />
                        <h2 className="text-lg font-semibold text-slate-200">Connecting eBay...</h2>
                        <p className="text-sm text-slate-400">Exchanging authorization code for access tokens.</p>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <CheckCircle2 size={40} className="text-emerald-400 mx-auto" />
                        <h2 className="text-lg font-semibold text-emerald-400">Connected!</h2>
                        <p className="text-sm text-slate-400">{message}</p>
                        <p className="text-xs text-slate-500">Redirecting to Settings...</p>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <AlertCircle size={40} className="text-red-400 mx-auto" />
                        <h2 className="text-lg font-semibold text-red-400">Connection Failed</h2>
                        <p className="text-sm text-slate-400">{message}</p>
                        <button
                            onClick={() => navigate('/settings', { replace: true })}
                            className="mt-4 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                            Back to Settings
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
