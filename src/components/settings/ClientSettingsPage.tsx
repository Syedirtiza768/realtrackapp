import { useCallback, useEffect, useState } from 'react';
import { Loader2, Palette, Save } from 'lucide-react';
import {
  COLOR_PRESETS,
  fetchClientSettings,
  normalizeHexColor,
  updateClientSettings,
  type ClientSettingsRecord,
  type PublicBranding,
} from '../../lib/clientBrandingApi';
import { notifyBrandingUpdated, useBranding } from '../../contexts/BrandingContext';
import Can from '../auth/Can';
import ProtectedRoute from '../auth/ProtectedRoute';
import { usePermissions } from '../../hooks/usePermissions';

function toBrandingDraft(data: ClientSettingsRecord): Partial<PublicBranding> {
  return {
    appName: data.appName,
    clientName: data.clientName,
    shortName: data.shortName,
    primaryColor: data.primaryColor,
    secondaryColor: data.secondaryColor,
    accentColor: data.accentColor,
    themeMode: data.themeMode,
    footerText: data.footerText,
    poweredByVisible: data.poweredByVisible,
  };
}

export default function ClientSettingsPage() {
  return (
    <ProtectedRoute permissions={['client_settings.view']}>
      <ClientSettingsForm />
    </ProtectedRoute>
  );
}

function ClientSettingsForm() {
  const { applyDraft, refresh } = useBranding();
  const { has } = usePermissions();
  const canManage = has('client_settings.manage');

  const [data, setData] = useState<ClientSettingsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchClientSettings();
      setData(res);
      applyDraft(toBrandingDraft(res));
    } catch (e: unknown) {
      setMessage({
        type: 'err',
        text: e instanceof Error ? e.message : 'Failed to load settings',
      });
    } finally {
      setLoading(false);
    }
  }, [applyDraft]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      void refresh();
    };
  }, [refresh]);

  const update = (patch: Partial<ClientSettingsRecord>) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      applyDraft(toBrandingDraft(next));
      return next;
    });
  };

  const save = async () => {
    if (!data || !canManage) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateClientSettings(data);
      setData(updated);
      applyDraft(toBrandingDraft(updated));
      notifyBrandingUpdated();
      setMessage({ type: 'ok', text: 'Settings saved — theme applied across the app.' });
    } catch (e: unknown) {
      setMessage({
        type: 'err',
        text: e instanceof Error ? e.message : 'Save failed',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-slate-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-red-400">{message?.text ?? 'Unable to load client settings'}</p>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Client settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Branding, color palette, and theme. Changes preview live before you save.
        </p>
      </div>

      {message && (
        <p
          className={`text-sm ${message.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {message.text}
        </p>
      )}

      {!canManage && (
        <p className="text-sm text-amber-300/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          You have view-only access. Contact a Super Admin to change branding.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-200 flex items-center gap-2">
            <Palette className="h-4 w-4" style={{ color: data.primaryColor }} />
            Identity
          </h3>
          <Field
            label="Application name"
            value={data.appName}
            disabled={!canManage}
            onChange={(v) => update({ appName: v })}
          />
          <Field
            label="Client name"
            value={data.clientName}
            disabled={!canManage}
            onChange={(v) => update({ clientName: v })}
          />
          <Field
            label="Short name (sidebar badge)"
            value={data.shortName ?? ''}
            disabled={!canManage}
            onChange={(v) => update({ shortName: v })}
          />
          <Field
            label="Footer text"
            value={data.footerText ?? ''}
            disabled={!canManage}
            onChange={(v) => update({ footerText: v })}
          />
          <Field
            label="Support email"
            value={data.supportEmail ?? ''}
            disabled={!canManage}
            onChange={(v) => update({ supportEmail: v })}
          />
        </div>

        <ThemePreview data={data} />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-200">Color palette</h3>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              disabled={!canManage}
              onClick={() =>
                update({
                  primaryColor: preset.primary,
                  secondaryColor: preset.secondary,
                  accentColor: preset.accent,
                })
              }
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-300 hover:border-slate-500 disabled:opacity-50 flex items-center gap-2"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: preset.primary }}
              />
              {preset.name}
            </button>
          ))}
        </div>
        <ColorField
          label="Primary"
          value={data.primaryColor}
          disabled={!canManage}
          onChange={(v) => update({ primaryColor: v })}
        />
        <ColorField
          label="Secondary"
          value={data.secondaryColor}
          disabled={!canManage}
          onChange={(v) => update({ secondaryColor: v })}
        />
        <ColorField
          label="Accent"
          value={data.accentColor}
          disabled={!canManage}
          onChange={(v) => update({ accentColor: v })}
        />
        <label className="block text-sm">
          <span className="text-slate-400 dark:text-slate-400">Theme mode</span>
          <select
            className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm disabled:opacity-60"
            value={data.themeMode}
            disabled={!canManage}
            onChange={(e) => update({ themeMode: e.target.value })}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={data.whiteLabelEnabled}
            onChange={(e) => update({ whiteLabelEnabled: e.target.checked })}
          />
          White-label enabled
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
          <input
            type="checkbox"
            disabled={!canManage}
            checked={data.poweredByVisible}
            onChange={(e) => update({ poweredByVisible: e.target.checked })}
          />
          Show &quot;Powered by&quot; badge
        </label>
      </div>

      <Can permission="client_settings.manage">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </Can>
    </div>
  );
}

function ThemePreview({ data }: { data: ClientSettingsRecord }) {
  const short = (data.shortName || data.appName || 'RT').slice(0, 2).toUpperCase();
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-200">Live preview</h3>
      <div
        className="rounded-lg border p-4 space-y-3"
        style={{
          borderColor: data.secondaryColor,
          backgroundColor: `${data.secondaryColor}33`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: data.primaryColor }}
          >
            {short}
          </div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{data.appName}</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-xs font-medium text-white"
            style={{ backgroundColor: data.primaryColor }}
          >
            Primary button
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-xs font-medium text-white"
            style={{ backgroundColor: data.accentColor }}
          >
            Accent
          </button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-400">
          Theme: <span className="text-slate-500 dark:text-slate-300">{data.themeMode}</span>
          {data.footerText && (
            <>
              {' '}
              · Footer: <span className="text-slate-500 dark:text-slate-300">{data.footerText}</span>
            </>
          )}
        </p>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Sidebar and login pages use these colors after save (preview applies immediately).
      </p>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const hex = normalizeHexColor(value, '#2563eb');
  return (
    <label className="block text-sm">
      <span className="text-slate-400 dark:text-slate-400">{label}</span>
      <div className="mt-1 flex gap-2 items-center">
        <input
          type="color"
          disabled={disabled}
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 cursor-pointer disabled:opacity-50"
        />
        <input
          className="flex-1 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onChange(normalizeHexColor(value, hex))}
        />
      </div>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400 dark:text-slate-400">{label}</span>
      <input
        className="mt-1 w-full rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
