import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Eye,
  Edit3,
  Star,
  Loader2,
  X,
  Code2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { sanitizeHtml } from '../../lib/sanitize';

const API = '/api/templates';

interface ListingTemplate {
  id: string;
  name: string;
  description: string | null;
  channel: string | null;
  category: string | null;
  templateType: 'description' | 'title' | 'full';
  content: string;
  css: string | null;
  variables: Record<string, unknown>[];
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  ebay: 'eBay',
  shopify: 'Shopify',
  amazon: 'Amazon',
  walmart: 'Walmart',
};

const TYPE_COLORS: Record<string, string> = {
  description: 'bg-blue-500/10 text-blue-400',
  title: 'bg-amber-500/10 text-amber-400',
  full: 'bg-purple-500/10 text-purple-400',
};

export default function TemplateManagerPage() {
  const [templates, setTemplates] = useState<ListingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ListingTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(API);
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch templates', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await fetch(`${API}/${id}`, { method: 'DELETE' });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setActionMsg('Template deleted');
    } catch (e) {
      setActionMsg('Failed to delete template');
    }
  };

  const previewTemplate = async (id: string) => {
    try {
      const res = await fetch(`${API}/${id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variables: {
            title: 'Sample Listing Title',
            description: 'This is a sample product description for preview purposes.',
            price: '29.99',
            brand: 'ACME',
            condition: 'Used',
            sku: 'SAMPLE-001',
          },
        }),
      });
      const data = await res.json();
      setPreviewHtml(data.html ?? '<p>No content</p>');
    } catch (e) {
      setActionMsg('Failed to preview template');
    }
  };

  const createTemplate = async (data: Partial<ListingTemplate>) => {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const created = await res.json();
      setTemplates((prev) => [created, ...prev]);
      setShowCreate(false);
      setActionMsg('Template created');
    } catch (e) {
      setActionMsg('Failed to create template');
    }
  };

  const updateTemplate = async (id: string, data: Partial<ListingTemplate>) => {
    try {
      const res = await fetch(`${API}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setEditing(null);
      setActionMsg('Template updated');
    } catch (e) {
      setActionMsg('Failed to update template');
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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Listing Templates</h2>
          <p className="text-sm text-slate-500 mt-1">
            {templates.length} template{templates.length !== 1 ? 's' : ''} · {templates.filter((t) => t.active).length} active
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> New Template
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

      {/* Preview Modal */}
      {previewHtml !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setPreviewHtml(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-slate-800">Template Preview</h3>
              <button onClick={() => setPreviewHtml(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }} />
          </div>
        </div>
      )}

      {showCreate && <TemplateForm onSubmit={createTemplate} onCancel={() => setShowCreate(false)} />}
      {editing && (
        <TemplateForm
          initial={editing}
          onSubmit={(data) => updateTemplate(editing.id, data)}
          onCancel={() => setEditing(null)}
        />
      )}

      {templates.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-slate-400 font-medium">No templates yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Create listing templates for brand-consistent formatting across channels.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className={`transition-colors ${template.active ? '' : 'opacity-50'}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    {template.isDefault && <Star size={14} className="text-amber-400 shrink-0" fill="currentColor" />}
                  </div>
                  {template.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{template.description}</p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${TYPE_COLORS[template.templateType] ?? ''}`}>
                    {template.templateType}
                  </span>
                  {template.channel && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                      {CHANNEL_LABELS[template.channel] ?? template.channel}
                    </span>
                  )}
                  {!template.channel && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                      All Channels
                    </span>
                  )}
                </div>

                <div className="bg-slate-800/50 rounded p-2 mb-3 max-h-20 overflow-hidden text-xs font-mono text-slate-400">
                  {template.content.slice(0, 200)}
                  {template.content.length > 200 && '...'}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => previewTemplate(template.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 text-slate-300 text-xs font-medium rounded hover:bg-slate-600 transition-colors"
                  >
                    <Eye size={12} /> Preview
                  </button>
                  <button
                    onClick={() => setEditing(template)}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 text-slate-300 text-xs font-medium rounded hover:bg-slate-600 transition-colors"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="flex items-center gap-1 px-2 py-1 text-red-400 text-xs font-medium rounded hover:bg-red-500/10 transition-colors ml-auto"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Template Form ─── */

function TemplateForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: ListingTemplate;
  onSubmit: (data: Partial<ListingTemplate>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [channel, setChannel] = useState(initial?.channel ?? '');
  const [templateType, setTemplateType] = useState(initial?.templateType ?? 'description');
  const [content, setContent] = useState(initial?.content ?? '<h1>{{title}}</h1>\n<p>{{description}}</p>\n<p>Price: ${{price}}</p>');
  const [css, setCss] = useState(initial?.css ?? '');
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      channel: channel || null,
      templateType: templateType as any,
      content,
      css: css || null,
      isDefault,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{initial ? 'Edit Template' : 'New Template'}</CardTitle>
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
                placeholder="e.g., eBay Pro Template"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Channels</option>
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Template Type</label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value as 'title' | 'description' | 'full')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="description">Description</option>
                <option value="title">Title</option>
                <option value="full">Full Listing</option>
              </select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Code2 size={12} /> Template Content * <span className="text-slate-600">(use {'{{variable}}'} syntax)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Custom CSS (optional)</label>
            <textarea
              value={css}
              onChange={(e) => setCss(e.target.value)}
              rows={3}
              placeholder=".listing-title { color: #333; }"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded bg-slate-800 border-slate-600"
              />
              Set as default
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} /> {initial ? 'Save Changes' : 'Create Template'}
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
