import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
  Eye,
} from 'lucide-react';

type EditorMode = 'visual' | 'html';

interface RichTextDescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Light eBay-preview chrome vs app dark/light form chrome */
  variant?: 'preview' | 'form';
  className?: string;
}

/** Strip only dangerous constructs; preserve eBay listing HTML structure. */
function prepareEditorHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(?:src|href)=["']javascript:[^"']*["']/gi, '');
}

function isVisuallyEmpty(html: string): boolean {
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
  return text.length === 0;
}

function runCommand(command: string, value?: string) {
  // document.execCommand remains the practical API for lightweight contentEditable toolbars.
  document.execCommand(command, false, value);
}

export default function RichTextDescriptionEditor({
  value,
  onChange,
  placeholder = 'Write the item description…',
  minHeight = 360,
  variant = 'form',
  className = '',
}: RichTextDescriptionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedHtml = useRef(value);
  const [mode, setMode] = useState<EditorMode>('visual');
  const [htmlDraft, setHtmlDraft] = useState(value);
  const labelId = useId();

  const isPreview = variant === 'preview';

  // Keep visual editor in sync when value changes externally (e.g. marketplace switch).
  useEffect(() => {
    if (mode !== 'visual') return;
    const el = editorRef.current;
    if (!el) return;
    if (value === lastEmittedHtml.current) return;
    lastEmittedHtml.current = value;
    el.innerHTML = prepareEditorHtml(value);
  }, [value, mode]);

  // Seed editor when switching into visual mode.
  useEffect(() => {
    if (mode !== 'visual') return;
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = prepareEditorHtml(value);
    lastEmittedHtml.current = value;
    // Only re-seed when entering visual mode; value sync handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode === 'html') {
      setHtmlDraft(value);
    }
  }, [mode, value]);

  const emitHtml = useCallback(
    (html: string) => {
      lastEmittedHtml.current = html;
      onChange(html);
    },
    [onChange],
  );

  const handleVisualInput = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    emitHtml(html);
  }, [emitHtml]);

  const handleToolbar = useCallback(
    (command: string, commandValue?: string) => {
      editorRef.current?.focus();
      if (command === 'createLink') {
        const url = window.prompt('Link URL', 'https://');
        if (!url) return;
        runCommand('createLink', url);
      } else if (command === 'formatBlock' && commandValue) {
        runCommand('formatBlock', commandValue);
      } else {
        runCommand(command, commandValue);
      }
      handleVisualInput();
    },
    [handleVisualInput],
  );

  const switchMode = (next: EditorMode) => {
    if (next === mode) return;
    if (next === 'html') {
      const html = editorRef.current?.innerHTML ?? value;
      setHtmlDraft(html);
      emitHtml(html);
      setMode('html');
      return;
    }
    // html → visual
    emitHtml(htmlDraft);
    setMode('visual');
  };

  const shellClass = isPreview
    ? 'border border-[#e5e5e5] rounded-xl overflow-hidden bg-white'
    : 'border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900';

  const toolbarClass = isPreview
    ? 'flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-[#e5e5e5] bg-[#f7f7f7]'
    : 'flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80';

  const modeTabActive = isPreview
    ? 'bg-white text-[#191919] shadow-sm'
    : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm';

  const modeTabIdle = isPreview
    ? 'text-[#707070] hover:text-[#191919]'
    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200';

  const btnClass = isPreview
    ? 'p-1.5 rounded text-[#191919] hover:bg-[#e5e5e5] disabled:opacity-40'
    : 'p-1.5 rounded text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40';

  const showPlaceholder = mode === 'visual' && isVisuallyEmpty(value);

  return (
    <div className={`${shellClass} ${className}`} aria-labelledby={labelId}>
      <div className={toolbarClass}>
        <div
          className={`flex rounded-md p-0.5 mr-2 ${isPreview ? 'bg-[#ebebeb]' : 'bg-slate-200/70 dark:bg-slate-900/60'}`}
          role="tablist"
          aria-label="Description editor mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'visual'}
            id={`${labelId}-visual`}
            onClick={() => switchMode('visual')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded ${mode === 'visual' ? modeTabActive : modeTabIdle}`}
          >
            <Eye className="h-3.5 w-3.5" />
            Visual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'html'}
            id={`${labelId}-html`}
            onClick={() => switchMode('html')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded ${mode === 'html' ? modeTabActive : modeTabIdle}`}
          >
            <Code2 className="h-3.5 w-3.5" />
            HTML
          </button>
        </div>

        {mode === 'visual' && (
          <>
            <ToolbarButton className={btnClass} label="Bold" onClick={() => handleToolbar('bold')}>
              <Bold className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton className={btnClass} label="Italic" onClick={() => handleToolbar('italic')}>
              <Italic className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton className={btnClass} label="Underline" onClick={() => handleToolbar('underline')}>
              <Underline className="h-3.5 w-3.5" />
            </ToolbarButton>
            <span className={`mx-1 h-4 w-px ${isPreview ? 'bg-[#d0d0d0]' : 'bg-slate-300 dark:bg-slate-600'}`} />
            <ToolbarButton className={btnClass} label="Heading" onClick={() => handleToolbar('formatBlock', 'h2')}>
              <Heading2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton className={btnClass} label="Subheading" onClick={() => handleToolbar('formatBlock', 'h3')}>
              <Heading3 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <span className={`mx-1 h-4 w-px ${isPreview ? 'bg-[#d0d0d0]' : 'bg-slate-300 dark:bg-slate-600'}`} />
            <ToolbarButton className={btnClass} label="Bullet list" onClick={() => handleToolbar('insertUnorderedList')}>
              <List className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton className={btnClass} label="Numbered list" onClick={() => handleToolbar('insertOrderedList')}>
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton className={btnClass} label="Insert link" onClick={() => handleToolbar('createLink')}>
              <Link2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton className={btnClass} label="Clear formatting" onClick={() => handleToolbar('removeFormat')}>
              <RemoveFormatting className="h-3.5 w-3.5" />
            </ToolbarButton>
          </>
        )}

        <span className={`ml-auto text-[10px] ${isPreview ? 'text-[#707070]' : 'text-slate-400'}`}>
          {mode === 'visual' ? 'WYSIWYG' : 'Raw HTML'}
        </span>
      </div>

      {mode === 'visual' ? (
        <div className="relative">
          {showPlaceholder && (
            <div
              className={`pointer-events-none absolute left-3 top-3 text-sm ${isPreview ? 'text-[#a0a0a0]' : 'text-slate-400'}`}
            >
              {placeholder}
            </div>
          )}
          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            aria-labelledby={`${labelId}-visual`}
            contentEditable
            suppressContentEditableWarning
            onInput={handleVisualInput}
            onBlur={handleVisualInput}
            className={`rt-desc-editor px-3 py-3 overflow-auto focus:outline-none ${
              isPreview ? 'text-[#333]' : 'text-slate-900 dark:text-slate-100'
            }`}
            style={{
              minHeight,
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          />
          <style>{`
            .rt-desc-editor h1, .rt-desc-editor h2, .rt-desc-editor h3 {
              font-weight: 700;
              margin: 0.6em 0 0.35em;
              color: inherit;
            }
            .rt-desc-editor h1 { font-size: 1.5em; }
            .rt-desc-editor h2 { font-size: 1.25em; }
            .rt-desc-editor h3 { font-size: 1.1em; }
            .rt-desc-editor p { margin: 0.4em 0; }
            .rt-desc-editor ul { list-style: disc; padding-left: 1.5em; margin: 0.4em 0; }
            .rt-desc-editor ol { list-style: decimal; padding-left: 1.5em; margin: 0.4em 0; }
            .rt-desc-editor a { color: #0654ba; text-decoration: underline; }
            .rt-desc-editor img { max-width: 100%; height: auto; }
            .rt-desc-editor table { border-collapse: collapse; width: 100%; }
            .rt-desc-editor td, .rt-desc-editor th { border: 1px solid #e5e5e5; padding: 6px 8px; }
          `}</style>
        </div>
      ) : (
        <textarea
          aria-labelledby={`${labelId}-html`}
          value={htmlDraft}
          onChange={(e) => {
            setHtmlDraft(e.target.value);
            emitHtml(e.target.value);
          }}
          placeholder="Enter HTML description…"
          className={`w-full resize-y px-3 py-3 font-mono text-xs leading-relaxed focus:outline-none ${
            isPreview
              ? 'bg-white text-[#191919]'
              : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
          }`}
          style={{ minHeight }}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={className}>
      {children}
    </button>
  );
}
