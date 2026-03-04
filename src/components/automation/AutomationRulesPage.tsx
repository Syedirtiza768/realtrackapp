import { useEffect, useState, useCallback } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  Play,
  ToggleLeft,
  ToggleRight,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

const API = '/api/automation-rules';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  triggerType: 'schedule' | 'event' | 'condition';
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
  conditions: Record<string, unknown>[];
  enabled: boolean;
  priority: number;
  lastExecutedAt: string | null;
  executionCount: number;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  update_price: 'Update Price',
  sync_inventory: 'Sync Inventory',
  publish: 'Publish Listing',
  end_listing: 'End Listing',
  notify: 'Send Notification',
  apply_template: 'Apply Template',
};

const TRIGGER_LABELS: Record<string, string> = {
  schedule: 'Scheduled',
  event: 'Event-Based',
  condition: 'Condition-Based',
};

const TRIGGER_COLORS: Record<string, string> = {
  schedule: 'bg-blue-500/10 text-blue-400',
  event: 'bg-amber-500/10 text-amber-400',
  condition: 'bg-purple-500/10 text-purple-400',
};

export default function AutomationRulesPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch automation rules', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const toggleRule = async (id: string) => {
    try {
      const res = await fetch(`${API}/${id}/toggle`, { method: 'PATCH' });
      const updated = await res.json();
      setRules((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setActionMsg('Failed to toggle rule');
    }
  };

  const executeRule = async (id: string) => {
    try {
      const res = await fetch(`${API}/${id}/execute`, { method: 'POST' });
      const result = await res.json();
      setActionMsg(result.executed ? `Executed: ${result.result}` : `Skipped: ${result.result}`);
      await fetchRules();
    } catch (e) {
      setActionMsg('Failed to execute rule');
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Delete this automation rule?')) return;
    try {
      await fetch(`${API}/${id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== id));
      setActionMsg('Rule deleted');
    } catch (e) {
      setActionMsg('Failed to delete rule');
    }
  };

  const createRule = async (data: Partial<AutomationRule>) => {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const created = await res.json();
      setRules((prev) => [created, ...prev]);
      setShowCreate(false);
      setActionMsg('Rule created');
    } catch (e) {
      setActionMsg('Failed to create rule');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Automation Rules</h2>
          <p className="text-sm text-slate-500 mt-1">
            {rules.length} rule{rules.length !== 1 ? 's' : ''} · {rules.filter((r) => r.enabled).length} active
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> New Rule
        </button>
      </div>

      {actionMsg && (
        <div
          className={`px-3 py-2 rounded-lg text-sm ${
            actionMsg.startsWith('Failed') ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
          }`}
        >
          {actionMsg}
          <button onClick={() => setActionMsg(null)} className="ml-2 text-xs opacity-60 hover:opacity-100">
            dismiss
          </button>
        </div>
      )}

      {showCreate && <CreateRuleForm onSubmit={createRule} onCancel={() => setShowCreate(false)} />}

      {rules.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-400 font-medium">No automation rules yet</p>
            <p className="text-sm text-slate-500 mt-1">Create your first rule to automate pricing, publishing, and more.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => toggleRule(rule.id)}
              onExecute={() => executeRule(rule.id)}
              onDelete={() => deleteRule(rule.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Rule Card ─── */

function RuleCard({
  rule,
  onToggle,
  onExecute,
  onDelete,
}: {
  rule: AutomationRule;
  onToggle: () => void;
  onExecute: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`transition-colors ${rule.enabled ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4">
        <button onClick={onToggle} className="shrink-0">
          {rule.enabled ? (
            <ToggleRight size={28} className="text-emerald-500" />
          ) : (
            <ToggleLeft size={28} className="text-slate-500" />
          )}
        </button>

        <button className="flex-1 min-w-0 text-left" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-200 truncate">{rule.name}</span>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${TRIGGER_COLORS[rule.triggerType] ?? ''}`}>
              {TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}
            </span>
            <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
              {ACTION_LABELS[rule.actionType] ?? rule.actionType}
            </span>
          </div>
          {rule.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{rule.description}</p>}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
            <Play size={12} />
            {rule.executionCount}
          </div>
          {rule.lastExecutedAt && (
            <span className="hidden lg:inline text-xs text-slate-500">
              <Clock size={12} className="inline mr-1" />
              {new Date(rule.lastExecutedAt).toLocaleDateString()}
            </span>
          )}
          <button
            onClick={onExecute}
            className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
            title="Execute now"
          >
            <Play size={16} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 size={16} />
          </button>
          {expanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 border-t border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 font-medium mb-1">Trigger Config</p>
              <pre className="bg-slate-800/50 rounded p-2 text-xs text-slate-300 overflow-auto max-h-32">
                {JSON.stringify(rule.triggerConfig, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Action Config</p>
              <pre className="bg-slate-800/50 rounded p-2 text-xs text-slate-300 overflow-auto max-h-32">
                {JSON.stringify(rule.actionConfig, null, 2)}
              </pre>
            </div>
            {rule.conditions.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-slate-500 font-medium mb-1">Conditions ({rule.conditions.length})</p>
                <pre className="bg-slate-800/50 rounded p-2 text-xs text-slate-300 overflow-auto max-h-32">
                  {JSON.stringify(rule.conditions, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span>Priority: {rule.priority}</span>
            <span>Executed: {rule.executionCount} times</span>
            <span>Created: {new Date(rule.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ─── Create Rule Form ─── */

function CreateRuleForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: Partial<AutomationRule>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<string>('event');
  const [actionType, setActionType] = useState<string>('notify');
  const [priority, setPriority] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      triggerType: triggerType as any,
      actionType,
      triggerConfig: {},
      actionConfig: {},
      conditions: [],
      priority,
      enabled: false,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">New Automation Rule</CardTitle>
        <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-200">
          <X size={16} />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Low stock price increase"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Trigger Type</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="schedule">Scheduled</option>
                <option value="event">Event-Based</option>
                <option value="condition">Condition-Based</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Action Type</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} /> Create Rule
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-slate-400 hover:text-slate-200 px-3 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
