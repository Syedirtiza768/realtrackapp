import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HardDrive,
  Search,
  Trash2,
  Loader2,
  ImageIcon,
  Upload,
  HardDriveUpload,
} from 'lucide-react';
import {
  searchDrive,
  deleteDriveImage,
  getDriveStats,
  type ImageDriveEntry,
  type ImageDriveSearchResponse,
  type ImageDriveStats,
} from '../../lib/imageDriveApi';
import ImageDriveUploadZone from './ImageDriveUploadZone';
import OptimizedImage from '../ui/OptimizedImage';

export default function ImageDrivePage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPartNumber, setUploadPartNumber] = useState('');

  const { data: stats } = useQuery<ImageDriveStats>({
    queryKey: ['image-drive-stats'],
    queryFn: getDriveStats,
    staleTime: 30_000,
  });

  const { data, isLoading, isFetching } = useQuery<ImageDriveSearchResponse>({
    queryKey: ['image-drive-search', searchQuery, page],
    queryFn: () => searchDrive(searchQuery, page),
    enabled: searchQuery.trim().length > 0,
    staleTime: 10_000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDriveImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image-drive-search'] });
      queryClient.invalidateQueries({ queryKey: ['image-drive-stats'] });
    },
  });

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPage(1);
    },
    [],
  );

  const handleUploadComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['image-drive-search'] });
    queryClient.invalidateQueries({ queryKey: ['image-drive-stats'] });
  }, [queryClient]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardDrive className="h-6 w-6 text-blue-500" />
          <div>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              Image Drive
            </h1>
            <p className="text-sm text-slate-500">
              Part-number-indexed image library for auto-attaching photos
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium"
        >
          <Upload className="h-4 w-4" />
          Upload by Part Number
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {stats.totalParts.toLocaleString()}
            </div>
            <div className="text-sm text-slate-500">Unique Part Numbers</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {stats.totalImages.toLocaleString()}
            </div>
            <div className="text-sm text-slate-500">Total Images</div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Upload Images to Part Number
          </h3>
          <div className="mb-3">
            <input
              type="text"
              value={uploadPartNumber}
              onChange={(e) => setUploadPartNumber(e.target.value)}
              placeholder="Enter part number..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <ImageDriveUploadZone
            partNumber={uploadPartNumber}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by part number..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </form>

      {isLoading || (isFetching && !data) ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="space-y-4">
          <div className="text-sm text-slate-500">
            {data.total} result{data.total !== 1 ? 's' : ''}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.items.map((item) => (
              <ImageDriveCard
                key={item.id}
                item={item}
                onDelete={() => deleteMutation.mutate(item.id)}
              />
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <ImageIcon className="h-10 w-10 mb-2" />
          <p className="text-sm">No images found for "{searchQuery}"</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <HardDriveUpload className="h-10 w-10 mb-2" />
          <p className="text-sm">Search by part number to find images</p>
        </div>
      )}
    </div>
  );
}

function ImageDriveCard({
  item,
  onDelete,
}: {
  item: ImageDriveEntry;
  onDelete: () => void;
}) {
  return (
    <div className="group relative bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="aspect-square bg-slate-100 dark:bg-slate-700">
        <OptimizedImage
          src={item.cdnUrl}
          alt={item.originalFilename ?? item.partNumberRaw}
          variant="medium"
          aspectRatio="1/1"
          className="w-full h-full"
        />
      </div>
      <div className="p-2">
        <div className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">
          {item.partNumberRaw}
        </div>
        <div className="text-xs text-slate-400 truncate">
          {item.originalFilename ?? item.s3Key.split('/').pop()}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="absolute top-1.5 right-1.5 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
        title="Remove from Image Drive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
