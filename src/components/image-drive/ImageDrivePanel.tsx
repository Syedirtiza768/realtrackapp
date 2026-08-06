import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Check, Minus, Image as ImageIcon } from 'lucide-react';
import { batchLookupDriveImages, type DriveFileEntry, type BatchLookupResult } from '../../lib/imageDriveApi';
import OptimizedImage from '../ui/OptimizedImage';

interface ImageDrivePanelProps {
  partNumbers: string[];
  onSelectImages?: (partNumber: string, images: DriveFileEntry[]) => void;
  compact?: boolean;
}

export default function ImageDrivePanel({
  partNumbers,
  onSelectImages,
  compact = false,
}: ImageDrivePanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Map<string, Set<string>>>(new Map());

  const { data, isLoading } = useQuery<BatchLookupResult>({
    queryKey: ['image-drive-batch', partNumbers.join(',')],
    queryFn: () => batchLookupDriveImages(partNumbers),
    enabled: partNumbers.length > 0,
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;

  const results = data.results ?? {};
  const matched = partNumbers.filter((pn) => {
    const norm = pn.trim().toLowerCase().replace(/[\s\-_./\\]+/g, '').replace(/[^a-z0-9]/g, '');
    return (results[norm]?.length ?? 0) > 0;
  });

  if (matched.length === 0) return null;

  const totalImages = matched.reduce((sum, pn) => {
    const norm = pn.trim().toLowerCase().replace(/[\s\-_./\\]+/g, '').replace(/[^a-z0-9]/g, '');
    return sum + (results[norm]?.length ?? 0);
  }, 0);

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-900/20">
        <ImageIcon className="h-4 w-4 text-blue-500" />
        <span className="text-blue-700 dark:text-blue-300">
          Image Drive: {matched.length}/{partNumbers.length} parts · {totalImages} images
        </span>
      </div>
    );
  }

  const toggleExpand = (pn: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pn)) next.delete(pn);
      else next.add(pn);
      return next;
    });
  };

  const toggleSelect = (pn: string, fileId: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(pn) ?? []);
      if (set.has(fileId)) set.delete(fileId);
      else set.add(fileId);
      next.set(pn, set);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10">
      <div className="flex items-center gap-2 border-b border-blue-200 px-3 py-2 dark:border-blue-800">
        <ImageIcon className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Image Drive: {matched.length}/{partNumbers.length} parts matched · {totalImages} images available
        </span>
      </div>

      <div className="divide-y divide-blue-100 dark:divide-blue-800/50">
        {partNumbers.map((pn) => {
          const norm = pn.trim().toLowerCase().replace(/[\s\-_./\\]+/g, '').replace(/[^a-z0-9]/g, '');
          const images = results[norm] ?? [];
          const hasImages = images.length > 0;
          const isExpanded = expanded.has(pn);
          const selectedSet = selected.get(pn) ?? new Set();

          return (
            <div key={pn}>
              <button
                onClick={() => hasImages && toggleExpand(pn)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-100/50 dark:hover:bg-blue-800/20"
              >
                {hasImages ? (
                  isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  )
                ) : (
                  <Minus className="h-3.5 w-3.5 text-slate-300" />
                )}
                {hasImages ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-slate-300" />
                )}
                <span className={hasImages ? 'font-medium text-slate-900 dark:text-white' : 'text-slate-400'}>
                  {pn}
                </span>
                {hasImages && (
                  <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-800 dark:text-blue-300">
                    {images.length}
                  </span>
                )}
              </button>

              {isExpanded && hasImages && (
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                    {images.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => toggleSelect(pn, img.id)}
                        className={`relative overflow-hidden rounded border-2 transition ${
                          selectedSet.has(img.id)
                            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                            : 'border-transparent hover:border-slate-300'
                        }`}
                      >
                        <OptimizedImage
                          src={img.cdnUrl}
                          alt=""
                          variant="thumb"
                          className="aspect-square w-full object-cover"
                        />
                        {selectedSet.has(img.id) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                            <Check className="h-5 w-5 text-blue-600" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {onSelectImages && selectedSet.size > 0 && (
                    <button
                      onClick={() =>
                        onSelectImages(
                          pn,
                          images.filter((img) => selectedSet.has(img.id)),
                        )
                      }
                      className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Use {selectedSet.size} selected image(s)
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
