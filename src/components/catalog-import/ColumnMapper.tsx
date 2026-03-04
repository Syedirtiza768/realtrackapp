import { useCallback, useState } from 'react';
import { Columns, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import type { CatalogField } from '../../types/catalogImport';

interface ColumnMapperProps {
  detectedHeaders: string[];
  initialMapping: Record<string, string>;
  catalogFields: CatalogField[];
  onConfirm: (mapping: Record<string, string>) => void;
  onAutoMap: () => void;
}

export default function ColumnMapper({
  detectedHeaders,
  initialMapping,
  catalogFields,
  onConfirm,
  onAutoMap,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);

  const handleFieldChange = useCallback(
    (csvHeader: string, catalogField: string) => {
      setMapping((prev) => {
        const next = { ...prev };
        if (catalogField === '') {
          delete next[csvHeader];
        } else {
          next[csvHeader] = catalogField;
        }
        return next;
      });
    },
    [],
  );

  const mappedCount = Object.keys(mapping).length;
  const requiredFields = catalogFields.filter((f) => f.required);
  const mappedValues = new Set(Object.values(mapping));
  const missingRequired = requiredFields.filter((f) => !mappedValues.has(f.field));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Columns className="h-5 w-5 text-amber-400" />
          Column Mapping
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Badge variant="default">{mappedCount} mapped</Badge>
            <Badge variant="secondary">{detectedHeaders.length} detected</Badge>
            {missingRequired.length > 0 && (
              <Badge variant="warning">
                Missing: {missingRequired.map((f) => f.label).join(', ')}
              </Badge>
            )}
          </div>
          <button
            onClick={onAutoMap}
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
          >
            <RotateCcw className="h-3 w-3" />
            Auto-detect
          </button>
        </div>

        {/* Mapping table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 py-2 px-3 font-medium">CSV Column</th>
                <th className="text-center text-slate-400 py-2 w-12"></th>
                <th className="text-left text-slate-400 py-2 px-3 font-medium">Catalog Field</th>
                <th className="text-center text-slate-400 py-2 px-3 font-medium w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {detectedHeaders.map((header) => {
                const currentField = mapping[header] || '';
                const isMapped = !!currentField;
                return (
                  <tr
                    key={header}
                    className="border-b border-slate-700/50 hover:bg-slate-800/50"
                  >
                    <td className="py-2 px-3">
                      <code className="text-blue-300 text-xs bg-slate-800 px-1.5 py-0.5 rounded">
                        {header}
                      </code>
                    </td>
                    <td className="text-center">
                      <ArrowRight className="h-3 w-3 text-slate-500 mx-auto" />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={currentField}
                        onChange={(e) => handleFieldChange(header, e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Skip this column --</option>
                        {catalogFields.map((field) => (
                          <option key={field.field} value={field.field}>
                            {field.label}{field.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-center">
                      {isMapped ? (
                        <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Confirm button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => onConfirm(mapping)}
            disabled={missingRequired.length > 0}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                missingRequired.length > 0
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }
            `}
          >
            <Check className="h-4 w-4" />
            Confirm Mapping & Start Import
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
