/* ── eBay Compliance Panel ─────────────────────────────────
 *  Shows compliance validation results and auto-corrections
 *  for imported catalog products.
 * ────────────────────────────────────────────────────────── */

import { useCallback, useState } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  FileCheck,
  Tag,
  Type,
  FileText,
  Car,
  ImageIcon,
  DollarSign,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { authPost, fetchWithAuth } from '../../lib/authApi';

/* ── Types ────────────────────────────────────────────────── */

interface ComplianceIssue {
  code: string;
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  autoFixed?: boolean;
  originalValue?: string;
  fixedValue?: string;
}

interface CategoryValidationResult {
  valid: boolean;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  confidence: number;
  issues: ComplianceIssue[];
}

interface TitleOptimizationResult {
  originalTitle: string;
  optimizedTitle: string;
  applied: boolean;
  lengthOk: boolean;
  seoScore: number;
  issues: ComplianceIssue[];
}

interface DescriptionEnhancementResult {
  hasDescription: boolean;
  enhanced: boolean;
  enhancedDescription: string | null;
  issues: ComplianceIssue[];
}

interface FitmentValidationResult {
  hasFitment: boolean;
  valid: boolean;
  normalized: boolean;
  vehicleCount: number;
  issues: ComplianceIssue[];
}

interface ImageComplianceResult {
  hasImages: boolean;
  imageCount: number;
  valid: boolean;
  issues: ComplianceIssue[];
}

interface PricingValidationResult {
  hasPrice: boolean;
  valid: boolean;
  issues: ComplianceIssue[];
}

interface ItemSpecificsResult {
  totalRequired: number;
  totalPresent: number;
  coveragePercent: number;
  missingRequired: string[];
  autoFilled: Array<{ field: string; value: string }>;
  issues: ComplianceIssue[];
}

interface ComplianceResult {
  productId: string;
  sku: string | null;
  compliant: boolean;
  complianceScore: number;
  issues: ComplianceIssue[];
  autoCorrections: ComplianceIssue[];
  categoryValidation: CategoryValidationResult;
  titleOptimization: TitleOptimizationResult;
  descriptionEnhancement: DescriptionEnhancementResult;
  fitmentValidation: FitmentValidationResult;
  imageCompliance: ImageComplianceResult;
  pricingValidation: PricingValidationResult;
  itemSpecifics: ItemSpecificsResult;
}

interface BatchComplianceResult {
  totalRecords: number;
  compliantRecords: number;
  nonCompliantRecords: number;
  autoFixedRecords: number;
  averageComplianceScore: number;
  results: ComplianceResult[];
  summary: {
    errorCount: number;
    warningCount: number;
    infoCount: number;
    totalAutoCorrections: number;
    topIssues: Array<{ code: string; count: number }>;
  };
}

/* ── API helpers ──────────────────────────────────────────── */

async function validateBatch(
  productIds: string[],
  autoFix = true,
): Promise<BatchComplianceResult> {
  return authPost<BatchComplianceResult>(
    '/api/catalog-import/compliance/validate-batch',
    { productIds, autoFix },
  );
}

async function validateProduct(
  productId: string,
  autoFix = true,
): Promise<ComplianceResult> {
  const qs = autoFix ? '' : '?autoFix=false';
  return fetchWithAuth<ComplianceResult>(
    `/api/catalog-import/compliance/validate/${productId}${qs}`,
    { method: 'POST' },
  );
}

/* ── Main Component ───────────────────────────────────────── */

export default function CompliancePanel({
  importId,
  productIds,
  importStatus,
}: {
  importId: string;
  productIds: string[];
  importStatus: string;
}) {
  const [batchResult, setBatchResult] = useState<BatchComplianceResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFix, setAutoFix] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ComplianceResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');

  const handleValidate = useCallback(async () => {
    if (!productIds.length) return;
    setValidating(true);
    setError(null);
    try {
      const result = await validateBatch(productIds, autoFix);
      setBatchResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  }, [productIds, autoFix]);

  const handleRevalidate = useCallback(async (productId: string) => {
    try {
      const result = await validateProduct(productId, autoFix);
      if (batchResult) {
        const updated = {
          ...batchResult,
          results: batchResult.results.map((r) =>
            r.productId === productId ? result : r,
          ),
        };
        setBatchResult(updated);
        setSelectedProduct(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-validation failed');
    }
  }, [batchResult, autoFix]);

  const isReady = importStatus === 'completed' && productIds.length > 0;

  return (
    <div className="space-y-4">
      {/* Main compliance card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              eBay Compliance Engine
              {batchResult && (
                <Badge variant={batchResult.averageComplianceScore >= 0.7 ? 'success' : batchResult.averageComplianceScore >= 0.4 ? 'warning' : 'destructive'}>
                  {Math.round(batchResult.averageComplianceScore * 100)}% Avg Score
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFix}
                  onChange={(e) => setAutoFix(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 h-3.5 w-3.5"
                />
                Auto-fix
              </label>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action button */}
          {isReady && !validating && (
            <button
              onClick={handleValidate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition"
            >
              <FileCheck className="h-4 w-4" />
              Validate {productIds.length} Records for eBay Compliance
            </button>
          )}

          {!isReady && importStatus !== 'completed' && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Compliance validation is available after import completes.</p>
          )}

          {validating && (
            <div className="flex items-center gap-2 text-blue-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validating records against eBay Motors requirements...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Summary */}
          {batchResult && (
            <>
              <ComplianceSummary result={batchResult} />

              {/* Top issues */}
              {batchResult.summary.topIssues.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Top Issues</p>
                  <div className="flex flex-wrap gap-1">
                    {batchResult.summary.topIssues.slice(0, 8).map((issue) => (
                      <Badge key={issue.code} variant="secondary">
                        {(issue.code ?? '').replace(/_/g, ' ')} ({issue.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Per-record results */}
      {batchResult && batchResult.results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedSection(expandedSection === 'records' ? null : 'records')}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                Record Details
                <Badge variant="secondary">{batchResult.results.length}</Badge>
              </div>
              {expandedSection === 'records' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
          {expandedSection === 'records' && (
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {batchResult.results.map((result) => (
                  <ComplianceResultRow
                    key={result.productId}
                    result={result}
                    isSelected={selectedProduct?.productId === result.productId}
                    onSelect={() => setSelectedProduct(
                      selectedProduct?.productId === result.productId ? null : result,
                    )}
                    onRevalidate={() => handleRevalidate(result.productId)}
                  />
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Selected product detail */}
      {selectedProduct && (
        <ComplianceDetail result={selectedProduct} />
      )}
    </div>
  );
}

/* ── Summary Stats ────────────────────────────────────────── */

function ComplianceSummary({ result }: { result: BatchComplianceResult }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <MiniStat label="Total" value={String(result.totalRecords)} color="text-slate-600 dark:text-slate-200" />
      <MiniStat
        label="Compliant"
        value={String(result.compliantRecords)}
        color="text-green-400"
        icon={<CheckCircle2 className="h-3 w-3" />}
      />
      <MiniStat
        label="Non-Compliant"
        value={String(result.nonCompliantRecords)}
        color="text-red-400"
        icon={<XCircle className="h-3 w-3" />}
      />
      <MiniStat
        label="Auto-Fixed"
        value={String(result.autoFixedRecords)}
        color="text-purple-400"
        icon={<Zap className="h-3 w-3" />}
      />
      <MiniStat
        label="Avg Score"
        value={`${Math.round(result.averageComplianceScore * 100)}%`}
        color={result.averageComplianceScore >= 0.7 ? 'text-green-400' : 'text-yellow-400'}
        icon={<Shield className="h-3 w-3" />}
      />
    </div>
  );
}

/* ── Result Row ───────────────────────────────────────────── */

function ComplianceResultRow({
  result,
  isSelected,
  onSelect,
  onRevalidate,
}: {
  result: ComplianceResult;
  isSelected: boolean;
  onSelect: () => void;
  onRevalidate: () => void;
}) {
  const errors = result.issues.filter((i) => i.severity === 'error').length;
  const warnings = result.issues.filter((i) => i.severity === 'warning').length;

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition ${
        isSelected ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'bg-slate-200/30 dark:bg-slate-700/30 hover:bg-slate-200/50 dark:bg-slate-700/50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0">
          {result.compliant ? (
            <CheckCircle2 className="h-5 w-5 text-green-400" />
          ) : (
            <XCircle className="h-5 w-5 text-red-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-600 dark:text-slate-200 truncate">{result.sku || result.productId.slice(0, 8)}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Score: {Math.round(result.complianceScore * 100)}%</span>
            {result.autoCorrections.length > 0 && (
              <span className="text-purple-400">{result.autoCorrections.length} auto-fixed</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {errors > 0 && <Badge variant="destructive">{errors} errors</Badge>}
        {warnings > 0 && <Badge variant="warning">{warnings} warnings</Badge>}
        {result.compliant && <Badge variant="success">Compliant</Badge>}
        <button
          onClick={(e) => { e.stopPropagation(); onRevalidate(); }}
          className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-200"
          title="Re-validate"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </button>
  );
}

/* ── Detail View ──────────────────────────────────────────── */

function ComplianceDetail({ result }: { result: ComplianceResult }) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['issues', 'autoCorrections']));

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const sections = [
    {
      id: 'category',
      icon: <Tag className="h-4 w-4 text-blue-400" />,
      label: 'Category Compliance',
      status: result.categoryValidation.valid,
      content: <CategorySection data={result.categoryValidation} />,
    },
    {
      id: 'specifics',
      icon: <FileCheck className="h-4 w-4 text-purple-400" />,
      label: `Item Specifics (${result.itemSpecifics.coveragePercent}%)`,
      status: result.itemSpecifics.missingRequired.length === 0,
      content: <SpecificsSection data={result.itemSpecifics} />,
    },
    {
      id: 'title',
      icon: <Type className="h-4 w-4 text-green-400" />,
      label: `Title (SEO: ${Math.round(result.titleOptimization.seoScore * 100)}%)`,
      status: result.titleOptimization.lengthOk && result.titleOptimization.issues.filter((i) => i.severity === 'error').length === 0,
      content: <TitleSection data={result.titleOptimization} />,
    },
    {
      id: 'description',
      icon: <FileText className="h-4 w-4 text-yellow-400" />,
      label: 'Description',
      status: result.descriptionEnhancement.hasDescription,
      content: <DescriptionSection data={result.descriptionEnhancement} />,
    },
    {
      id: 'fitment',
      icon: <Car className="h-4 w-4 text-orange-400" />,
      label: `Fitment (${result.fitmentValidation.vehicleCount} vehicles)`,
      status: result.fitmentValidation.valid,
      content: <FitmentSection data={result.fitmentValidation} />,
    },
    {
      id: 'images',
      icon: <ImageIcon className="h-4 w-4 text-cyan-400" />,
      label: `Images (${result.imageCompliance.imageCount})`,
      status: result.imageCompliance.valid,
      content: <ImageSection data={result.imageCompliance} />,
    },
    {
      id: 'pricing',
      icon: <DollarSign className="h-4 w-4 text-emerald-400" />,
      label: 'Pricing & Policies',
      status: result.pricingValidation.valid,
      content: <PricingSection data={result.pricingValidation} />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          {result.sku || result.productId.slice(0, 8)} — Compliance Report
          <ScoreBadge score={result.complianceScore} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Auto-corrections */}
        {result.autoCorrections.length > 0 && (
          <SectionToggle
            id="autoCorrections"
            open={openSections.has('autoCorrections')}
            onToggle={() => toggleSection('autoCorrections')}
            icon={<Sparkles className="h-4 w-4 text-purple-400" />}
            label={`Auto-Corrections (${result.autoCorrections.length})`}
          >
            <div className="space-y-1.5">
              {result.autoCorrections.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2 bg-purple-500/10 rounded">
                  <Zap className="h-3.5 w-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-slate-600 dark:text-slate-200">{c.message}</span>
                    {c.originalValue && c.fixedValue && (
                      <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                        <span className="line-through">{c.originalValue.slice(0, 50)}</span>
                        {' → '}
                        <span className="text-green-400">{c.fixedValue.slice(0, 50)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionToggle>
        )}

        {/* All issues */}
        {result.issues.length > 0 && (
          <SectionToggle
            id="issues"
            open={openSections.has('issues')}
            onToggle={() => toggleSection('issues')}
            icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
            label={`Issues (${result.issues.length})`}
          >
            <div className="space-y-1">
              {result.issues.map((issue, i) => (
                <IssueRow key={i} issue={issue} />
              ))}
            </div>
          </SectionToggle>
        )}

        {/* Validation sections */}
        {sections.map((section) => (
          <SectionToggle
            key={section.id}
            id={section.id}
            open={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
            icon={section.icon}
            label={section.label}
            status={section.status}
          >
            {section.content}
          </SectionToggle>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Section Components ───────────────────────────────────── */

function CategorySection({ data }: { data: CategoryValidationResult }) {
  return (
    <div className="text-xs space-y-1">
      {data.valid ? (
        <p className="text-green-400">Category is valid: {data.suggestedCategoryName} ({data.suggestedCategoryId})</p>
      ) : data.suggestedCategoryId ? (
        <p className="text-yellow-400">Suggested: {data.suggestedCategoryName} ({data.suggestedCategoryId}) — Confidence: {Math.round(data.confidence * 100)}%</p>
      ) : (
        <p className="text-red-400">Could not determine eBay category</p>
      )}
      {data.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
    </div>
  );
}

function SpecificsSection({ data }: { data: ItemSpecificsResult }) {
  return (
    <div className="text-xs space-y-2">
      <div className="flex items-center gap-4">
        <span className="text-slate-500 dark:text-slate-400">Coverage: {data.coveragePercent}%</span>
        <span className="text-slate-500 dark:text-slate-400">Present: {data.totalPresent}/{data.totalRequired}</span>
      </div>
      {data.missingRequired.length > 0 && (
        <div>
          <p className="text-red-400 mb-1">Missing Required:</p>
          <div className="flex flex-wrap gap-1">
            {data.missingRequired.map((f) => <Badge key={f} variant="destructive">{f}</Badge>)}
          </div>
        </div>
      )}
      {data.autoFilled.length > 0 && (
        <div>
          <p className="text-purple-400 mb-1">Auto-Filled:</p>
          {data.autoFilled.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-500 dark:text-slate-300">
              <Sparkles className="h-3 w-3 text-purple-400" />
              {f.field}: <span className="text-green-400">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TitleSection({ data }: { data: TitleOptimizationResult }) {
  return (
    <div className="text-xs space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-slate-500 dark:text-slate-400">Length: {data.originalTitle.length}/80 {data.lengthOk ? '✓' : '✗'}</span>
        <span className="text-slate-500 dark:text-slate-400">SEO: {Math.round(data.seoScore * 100)}%</span>
      </div>
      {data.applied && data.optimizedTitle !== data.originalTitle && (
        <div className="p-2 bg-purple-500/10 rounded">
          <p className="text-slate-500 dark:text-slate-400 line-through mb-0.5">{data.originalTitle}</p>
          <p className="text-green-400">{data.optimizedTitle}</p>
        </div>
      )}
      {data.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
    </div>
  );
}

function DescriptionSection({ data }: { data: DescriptionEnhancementResult }) {
  return (
    <div className="text-xs space-y-1">
      {data.hasDescription ? (
        <p className="text-green-400">Has description</p>
      ) : (
        <p className="text-red-400">No description</p>
      )}
      {data.enhanced && <p className="text-purple-400">Description was auto-enhanced</p>}
      {data.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
    </div>
  );
}

function FitmentSection({ data }: { data: FitmentValidationResult }) {
  return (
    <div className="text-xs space-y-1">
      {data.hasFitment ? (
        <p className="text-green-400">{data.vehicleCount} vehicle(s) — {data.valid ? 'Valid' : 'Issues found'}</p>
      ) : (
        <p className="text-yellow-400">No fitment data provided</p>
      )}
      {data.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
    </div>
  );
}

function ImageSection({ data }: { data: ImageComplianceResult }) {
  return (
    <div className="text-xs space-y-1">
      {data.hasImages ? (
        <p className={data.valid ? 'text-green-400' : 'text-yellow-400'}>
          {data.imageCount} image(s) — {data.valid ? 'Compliant' : 'Issues found'}
        </p>
      ) : (
        <p className="text-red-400">No images — at least 1 required</p>
      )}
      {data.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
    </div>
  );
}

function PricingSection({ data }: { data: PricingValidationResult }) {
  return (
    <div className="text-xs space-y-1">
      {data.hasPrice && data.valid ? (
        <p className="text-green-400">Price and policies are valid</p>
      ) : !data.hasPrice ? (
        <p className="text-red-400">Price is missing</p>
      ) : (
        <p className="text-yellow-400">Issues with pricing/policies</p>
      )}
      {data.issues.map((issue, i) => <IssueRow key={i} issue={issue} />)}
    </div>
  );
}

/* ── Reusable UI components ───────────────────────────────── */

function SectionToggle({
  id,
  open,
  onToggle,
  icon,
  label,
  status,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  status?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200/50 dark:border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2.5 hover:bg-slate-200/30 dark:bg-slate-700/30 transition text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-slate-600 dark:text-slate-200">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {status !== undefined && (
            status
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              : <XCircle className="h-3.5 w-3.5 text-red-400" />
          )}
          {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />}
        </div>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: ComplianceIssue }) {
  const icons = {
    error: <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />,
    warning: <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />,
    info: <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />,
  };
  const colors = {
    error: 'bg-red-500/5',
    warning: 'bg-amber-500/5',
    info: 'bg-blue-500/5',
  };

  return (
    <div className={`flex items-start gap-2 p-1.5 rounded text-xs ${colors[issue.severity]}`}>
      {icons[issue.severity]}
      <div className="min-w-0">
        <span className="text-slate-500 dark:text-slate-300">{issue.message}</span>
        {issue.suggestion && (
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">💡 {issue.suggestion}</p>
        )}
        {issue.autoFixed && (
          <span className="text-purple-400 ml-1">(auto-fixed)</span>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const variant = pct >= 70 ? 'success' as const : pct >= 40 ? 'warning' as const : 'destructive' as const;
  return <Badge variant={variant}>{pct}%</Badge>;
}

function MiniStat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="p-2 rounded bg-slate-200/40 dark:bg-slate-700/40">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${color} flex items-center gap-1`}>
        {icon}
        {value}
      </p>
    </div>
  );
}
