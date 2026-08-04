import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HardDrive, Check, Dash, Loader2, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import { batchLookupDriveImages, type ImageDriveEntry, type BatchLookupResult } from '../../lib/imageDriveApi';
import OptimizedImage from '../ui/OptimizedImage';

interface ImageDrivePanelProps {
  partNumbers: string[];
  onSelectImages?: (partNumber: string, images: ImageDriveEntry[]) => void;
  compact?: boolean;
}

export default function ImageDrivePanel({ partNumbers, onSelectImages, compact }: ImageDrivePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});

  const uniquePartNumbers = useMemo(
    () => [...new Set(partNumbers.map((p) => p.trim()).filter(Boolean))],
    [partNumbers],
  );

  const { data, isLoading } = useQuery<BatchLookupResult>({
    queryKey: ['image-drive-batch', uniquePartNumbers],
    queryFn: () => batchLookupDriveImages(uniquePartNumbers),
    enabled: uniquePartNumbers.length > 0,
    staleTime: 60_000,
  });

  if (uniquePartNumbers.length === 0) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Image Drive...
      </div>
    );
  }

  if (!data) return null;

  const matchedCount = data.summary.filter((s) => s.count > 0).length;
  const totalImages = data.summary.reduce((sum, s) => sum + s.count, 0);

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <HardDrive className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Image Drive:</span>{' '}
          <span className="text-green-600 dark:text-green-400">{matchedCount}/{uniquePartNumbers.length} parts</span>
          <span className="text-slate-400 mx-1.5">·</span>
          <span className="text-slate-500">{totalImages} images total</span>
        </div>
      </div>
    );
  }

  const toggleExpand = (pn: string) => {
    setExpanded((prev) => (prev === pn ? null : pn));
  };

  const toggleSelect = (pn: string, imgId: string) => {
    setSelected((prev) => {
      const current = prev[pn] ?? new Set();
      const next = new Set(current);
      if (next.has(imgId)) next.delete(imgId);
      else next.add(imgId);
      return { ...prev, [pn]: next };
    });
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
        <HardDrive className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Image Drive
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {matchedCount} matched · {totalImages} images
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
        {data.summary.map((item) => {
          const normalized = item.partNumber.toLowerCase().replace(/[\s\-_./\\]+/g, '').replace(/[^a-z0-9]/g, '');
          const images = data.results[normalized] ?? [];
          const isExpanded = expanded === item.partNumber;
          const selectedIds = selected[item.partNumber] ?? new Set();

          return (
            <div key={item.partNumber}>
              <button
                type="button"
                onClick={() => toggleExpand(item.partNumber)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                {item.count > 0 ? (
                  <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <Dash className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                )}
                <span className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate text-left flex-1">
                  {item.partNumber}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${item.count > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                  {item.count}
                </span>
                {item.count > 0 && (
                  isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>

              {isExpanded && images.length > 0 && (
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-4 gap-1.5">
                    {images.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => toggleSelect(item.partNumber, img.id)}
                        className={`relative aspect-square rounded overflow-hidden border-2 transition-colors ${
                          selectedIds.has(img.id)
                            ? 'border-blue-500 ring-1 ring-blue-500'
                            : 'border-transparent hover:border-slate-300'
                        }`}
                      >
                        <OptimizedImage
                          src={img.cdnUrl}
                          alt={img.originalFilename ?? ''}
                          variant="thumb"
                          aspectRatio="1/1"
                          className="w-full h-full"
                        />
                        {selectedIds.has(img.id) && (
                          <div className="absolute top-0.5 right-0.5 bg-blue-500 rounded-full p-0.5">
                            <Check className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {onSelectImages && selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const picked = images.filter((img) => selectedIds.has(img.id));
                        onSelectImages(item.partNumber, picked);
                      }}
                      className="mt-2 w-full text-xs px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500"
                    >
                      Use {selectedIds.size} selected image{selectedIds.size !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
