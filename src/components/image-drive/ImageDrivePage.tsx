import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FolderPlus,
  Upload,
  Grid3X3,
  List,
  ChevronRight,
  HardDrive,
  Image as ImageIcon,
  Trash2,
  Link2,
  X,
  Edit3,
  Check,
  Home,
  Search,
  Copy,
  Download,
  CheckSquare,
  Square,
  ChevronLeft,
} from 'lucide-react';
import {
  listFolders,
  createFolder,
  deleteFolder,
  updateFolder,
  listFiles,
  uploadToFolder,
  uploadAutoCreate,
  uploadFolder,
  deleteFile,
  bulkDeleteFiles,
  searchDrive,
  getDriveStats,
  type DriveFolderEntry,
  type DriveFileEntry,
} from '../../lib/imageDriveApi';
import {
  collectDroppedImageDriveFiles,
  getImageDriveRootFolderName,
  toImageDriveFolderFiles,
  type ImageDriveFolderFile,
} from '../../lib/imageDriveUpload';
import OptimizedImage from '../ui/OptimizedImage';
import ImageZoom from '../ui/ImageZoom';

type ViewMode = 'grid' | 'list';
type SortOption = 'name' | 'date' | 'size';
type BreadcrumbItem = { id: string | null; name: string };

export default function ImageDrivePage() {
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [filePage, setFilePage] = useState(1);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'Image Drive' },
  ]);

  const { data: stats } = useQuery({
    queryKey: ['image-drive-stats'],
    queryFn: getDriveStats,
  });

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['image-drive-folders'],
    queryFn: listFolders,
    enabled: currentFolderId === null && !isSearching,
  });

  const { data: fileList, isLoading: filesLoading } = useQuery({
    queryKey: ['image-drive-files', currentFolderId, filePage],
    queryFn: () => listFiles(currentFolderId!, filePage, 50),
    enabled: currentFolderId !== null,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['image-drive-search', searchQuery],
    queryFn: () => searchDrive(searchQuery, 1, 100),
    enabled: isSearching && searchQuery.trim().length >= 2,
  });

  const sortedFolders = [...folders].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'date') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    return b.totalSizeBytes - a.totalSizeBytes;
  });

  const navigateToFolder = useCallback(
    (folder: DriveFolderEntry) => {
      setCurrentFolderId(folder.id);
      setCurrentFolderName(folder.name);
      setFilePage(1);
      setSelectedFiles(new Set());
      setSelectMode(false);
      setBreadcrumbs([
        { id: null, name: 'Image Drive' },
        { id: folder.id, name: folder.name },
      ]);
    },
    [],
  );

  const navigateToRoot = useCallback(() => {
    setCurrentFolderId(null);
    setCurrentFolderName('');
    setFilePage(1);
    setSelectedFiles(new Set());
    setSelectMode(false);
    setBreadcrumbs([{ id: null, name: 'Image Drive' }]);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setIsSearching(q.trim().length >= 2);
    if (q.trim().length >= 2) {
      setCurrentFolderId(null);
    }
  }, []);

  const openLightbox = useCallback((urls: string[], index: number) => {
    setLightboxImages(urls);
    setLightboxIndex(index);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedFiles.size === 0) return;
    const ids = [...selectedFiles];
    const confirmed = window.confirm(
      `Delete ${ids.length} file${ids.length > 1 ? 's' : ''}? This cannot be undone.`,
    );
    if (!confirmed) return;

    await bulkDeleteFiles(ids);
    setSelectedFiles(new Set());
    setSelectMode(false);
    queryClient.invalidateQueries({ queryKey: ['image-drive-files'] });
    queryClient.invalidateQueries({ queryKey: ['image-drive-folders'] });
    queryClient.invalidateQueries({ queryKey: ['image-drive-stats'] });
  }, [selectedFiles, queryClient]);

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-3">
          <HardDrive className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Image Drive
          </h1>
          {stats && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {stats.totalFolders} folders · {stats.totalFiles} files
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search folders..."
              className="w-56 rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="name">Sort: Name</option>
            <option value="date">Sort: Date</option>
            <option value="size">Sort: Size</option>
          </select>

          {currentFolderId && (
            <>
              <button
                onClick={() => {
                  setSelectMode(!selectMode);
                  if (selectMode) setSelectedFiles(new Set());
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                  selectMode
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <CheckSquare className="h-4 w-4" />
                {selectMode ? 'Cancel' : 'Select'}
              </button>
              {selectMode && selectedFiles.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete {selectedFiles.size}
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setShowCreateFolder(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Breadcrumbs + view toggle */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-2 dark:border-slate-700 dark:bg-slate-800">
        <nav className="flex items-center gap-1 text-sm">
          {breadcrumbs.map((item, i) => (
            <span key={item.id ?? 'root'} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              )}
              <button
                onClick={() =>
                  item.id === null ? navigateToRoot() : undefined
                }
                className={`rounded px-1.5 py-0.5 ${
                  i === breadcrumbs.length - 1
                    ? 'font-medium text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {i === 0 ? (
                  <Home className="inline h-3.5 w-3.5" />
                ) : (
                  item.name
                )}
              </button>
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded p-1.5 ${
              viewMode === 'grid'
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-600 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded p-1.5 ${
              viewMode === 'list'
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-600 dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Search results */}
        {isSearching && (
          <SearchResults
            results={searchResults?.items ?? []}
            loading={searchLoading}
            viewMode={viewMode}
            onOpenFile={(file) =>
              openLightbox([file.cdnUrl], 0)
            }
          />
        )}

        {/* Root: show folders */}
        {currentFolderId === null && !isSearching && (
          <FolderGrid
            folders={sortedFolders}
            loading={foldersLoading}
            viewMode={viewMode}
            onOpen={navigateToFolder}
            onDelete={(id) => {
              if (!window.confirm('Delete this folder and all its files? This cannot be undone.')) return;
              deleteFolder(id).then(() =>
                queryClient.invalidateQueries({ queryKey: ['image-drive-folders'] }),
              );
            }}
            onUpdate={(id, updates) => {
              updateFolder(id, updates).then(() =>
                queryClient.invalidateQueries({ queryKey: ['image-drive-folders'] }),
              );
            }}
          />
        )}

        {/* Inside folder: show files */}
        {currentFolderId && (
          <>
            <FileGrid
              files={fileList?.items ?? []}
              loading={filesLoading}
              viewMode={viewMode}
              folderName={currentFolderName}
              selectMode={selectMode}
              selectedFiles={selectedFiles}
              onToggleSelect={(id) => {
                setSelectedFiles((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              onDelete={(id) => {
                if (!window.confirm('Delete this file? This cannot be undone.')) return;
                deleteFile(id).then(() => {
                  queryClient.invalidateQueries({
                    queryKey: ['image-drive-files', currentFolderId],
                  });
                  queryClient.invalidateQueries({
                    queryKey: ['image-drive-folders'],
                  });
                  queryClient.invalidateQueries({
                    queryKey: ['image-drive-stats'],
                  });
                });
              }}
              onPreview={(file) => {
                const allUrls = (fileList?.items ?? []).map((f) => f.cdnUrl);
                const idx = allUrls.indexOf(file.cdnUrl);
                openLightbox(allUrls, Math.max(0, idx));
              }}
            />

            {/* Pagination */}
            {fileList && fileList.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setFilePage((p) => Math.max(1, p - 1))}
                  disabled={filePage <= 1}
                  className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-slate-600"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Page {fileList.page} of {fileList.totalPages}
                </span>
                <button
                  onClick={() => setFilePage((p) => Math.min(fileList.totalPages, p + 1))}
                  disabled={filePage >= fileList.totalPages}
                  className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40 dark:border-slate-600"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create folder modal */}
      {showCreateFolder && (
        <CreateFolderModal
          onClose={() => setShowCreateFolder(false)}
          onCreate={(name, partNumber) => {
            createFolder(name, partNumber).then(() => {
              queryClient.invalidateQueries({
                queryKey: ['image-drive-folders'],
              });
              setShowCreateFolder(false);
            });
          }}
        />
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          folderId={currentFolderId}
          folderName={currentFolderName}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            if (currentFolderId) {
              queryClient.invalidateQueries({
                queryKey: ['image-drive-files', currentFolderId],
              });
            }
            queryClient.invalidateQueries({
              queryKey: ['image-drive-folders'],
            });
            queryClient.invalidateQueries({
              queryKey: ['image-drive-stats'],
            });
            setShowUpload(false);
          }}
        />
      )}

      {/* Lightbox */}
      {lightboxImages && (
        <ImageZoom
          images={lightboxImages}
          index={lightboxIndex}
          onClose={() => setLightboxImages(null)}
        />
      )}

      {/* Drag-drop zone at root for auto-create */}
      {currentFolderId === null && !isSearching && (
        <RootDropZone
          onUploaded={() => {
            queryClient.invalidateQueries({ queryKey: ['image-drive-folders'] });
            queryClient.invalidateQueries({ queryKey: ['image-drive-stats'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Search Results ──────────────────────────────────────────

function SearchResults({
  results,
  loading,
  viewMode,
  onOpenFile,
}: {
  results: Array<DriveFileEntry & { folderName: string }>;
  loading: boolean;
  viewMode: ViewMode;
  onOpenFile: (file: DriveFileEntry) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        Searching...
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Search className="mb-4 h-12 w-12" />
        <p className="text-lg font-medium">No results found</p>
        <p className="text-sm">Try a different search term</p>
      </div>
    );
  }

  return (
    <div
      className={
        viewMode === 'grid'
          ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          : 'flex flex-col gap-2'
      }
    >
      {results.map((file) => (
        <div key={file.id} className="group relative">
          <div
            className="aspect-square cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700"
            onClick={() => onOpenFile(file)}
          >
            <OptimizedImage
              src={file.cdnUrl}
              alt={file.filename}
              variant="small"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-1 px-1">
            <p className="truncate text-xs text-slate-600 dark:text-slate-400">
              {file.filename}
            </p>
            <p className="truncate text-xs text-blue-500">
              {file.folderName}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Folder Grid ─────────────────────────────────────────────

function FolderGrid({
  folders,
  loading,
  viewMode,
  onOpen,
  onDelete,
  onUpdate,
}: {
  folders: DriveFolderEntry[];
  loading: boolean;
  viewMode: ViewMode;
  onOpen: (folder: DriveFolderEntry) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: { name?: string; linkedPartNumber?: string | null }) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPartNumber, setEditPartNumber] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading folders...
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <FolderPlus className="mb-4 h-12 w-12" />
        <p className="text-lg font-medium">No folders yet</p>
        <p className="text-sm">Create a folder or drag files here to get started</p>
      </div>
    );
  }

  return (
    <div
      className={
        viewMode === 'grid'
          ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          : 'flex flex-col gap-2'
      }
    >
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          viewMode={viewMode}
          isEditing={editingId === folder.id}
          editName={editName}
          editPartNumber={editPartNumber}
          onOpen={() => onOpen(folder)}
          onDelete={() => onDelete(folder.id)}
          onStartEdit={() => {
            setEditingId(folder.id);
            setEditName(folder.name);
            setEditPartNumber(folder.linkedPartNumber || '');
          }}
          onCancelEdit={() => setEditingId(null)}
          onSaveEdit={() => {
            onUpdate(folder.id, {
              name: editName,
              linkedPartNumber: editPartNumber || null,
            });
            setEditingId(null);
          }}
          onEditNameChange={setEditName}
          onEditPartNumberChange={setEditPartNumber}
        />
      ))}
    </div>
  );
}

// ─── Folder Card ─────────────────────────────────────────────

function FolderCard({
  folder,
  viewMode,
  isEditing,
  editName,
  editPartNumber,
  onOpen,
  onDelete,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditNameChange,
  onEditPartNumberChange,
}: {
  folder: DriveFolderEntry;
  viewMode: ViewMode;
  isEditing: boolean;
  editName: string;
  editPartNumber: string;
  onOpen: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditNameChange: (v: string) => void;
  onEditPartNumberChange: (v: string) => void;
}) {
  if (viewMode === 'list') {
    return (
      <div className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600">
        <button onClick={onOpen} className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-100 dark:bg-blue-900/30">
            {folder.thumbnailUrls.length > 0 ? (
              <img
                src={folder.thumbnailUrls[0]}
                alt=""
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <ImageIcon className="h-5 w-5 text-blue-500" />
            )}
          </div>
          <div className="text-left">
            {isEditing ? (
              <input
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="rounded border px-1 text-sm dark:border-slate-600 dark:bg-slate-700"
              />
            ) : (
              <p className="font-medium text-slate-900 dark:text-white">
                {folder.name}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {folder.fileCount} files · {formatBytes(folder.totalSizeBytes)}
              {folder.linkedPartNumber && (
                <span className="ml-2 inline-flex items-center gap-1 text-blue-500">
                  <Link2 className="h-3 w-3" />
                  {folder.linkedPartNumber}
                </span>
              )}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          {isEditing ? (
            <>
              <button onClick={onSaveEdit} className="rounded p-1 text-green-500 hover:bg-green-100">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={onCancelEdit} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={onStartEdit} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <Edit3 className="h-4 w-4" />
              </button>
              <button onClick={onDelete} className="rounded p-1 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <button
        onClick={onOpen}
        className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-600"
      >
        <div className="flex aspect-square items-center justify-center bg-slate-100 dark:bg-slate-700">
          {folder.thumbnailUrls.length > 0 ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
              {folder.thumbnailUrls.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ))}
            </div>
          ) : (
            <ImageIcon className="h-10 w-10 text-slate-300 dark:text-slate-500" />
          )}
        </div>
        <div className="px-3 py-2 text-left">
          {isEditing ? (
            <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
                className="rounded border px-1 text-xs dark:border-slate-600 dark:bg-slate-700"
              />
              <input
                value={editPartNumber}
                onChange={(e) => onEditPartNumberChange(e.target.value)}
                placeholder="Part number"
                className="rounded border px-1 text-xs dark:border-slate-600 dark:bg-slate-700"
              />
              <div className="flex gap-1">
                <button onClick={onSaveEdit} className="rounded p-0.5 text-green-500">
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={onCancelEdit} className="rounded p-0.5 text-slate-400">
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {folder.name}
              </p>
              <p className="text-xs text-slate-500">
                {folder.fileCount} files
                {folder.linkedPartNumber && (
                  <span className="ml-1 text-blue-500">
                    <Link2 className="mr-0.5 inline h-3 w-3" />
                    {folder.linkedPartNumber}
                  </span>
                )}
              </p>
            </>
          )}
        </div>
      </button>

      {/* Actions overlay */}
      {!isEditing && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit();
            }}
            className="rounded bg-white/90 p-1.5 text-slate-600 shadow-sm hover:bg-white dark:bg-slate-700/90 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded bg-white/90 p-1.5 text-red-500 shadow-sm hover:bg-white dark:bg-slate-700/90 dark:hover:bg-slate-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── File Grid ───────────────────────────────────────────────

function FileGrid({
  files,
  loading,
  viewMode,
  folderName,
  selectMode,
  selectedFiles,
  onToggleSelect,
  onDelete,
  onPreview,
}: {
  files: DriveFileEntry[];
  loading: boolean;
  viewMode: ViewMode;
  folderName: string;
  selectMode: boolean;
  selectedFiles: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (file: DriveFileEntry) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading files...
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Upload className="mb-4 h-12 w-12" />
        <p className="text-lg font-medium">No files in {folderName}</p>
        <p className="text-sm">Upload images to this folder</p>
      </div>
    );
  }

  return (
    <div
      className={
        viewMode === 'grid'
          ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
          : 'flex flex-col gap-2'
      }
    >
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          viewMode={viewMode}
          selectMode={selectMode}
          selected={selectedFiles.has(file.id)}
          onToggleSelect={() => onToggleSelect(file.id)}
          onDelete={() => onDelete(file.id)}
          onPreview={() => onPreview(file)}
        />
      ))}
    </div>
  );
}

// ─── File Card ───────────────────────────────────────────────

function FileCard({
  file,
  viewMode,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
  onPreview,
}: {
  file: DriveFileEntry;
  viewMode: ViewMode;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const thumbUrl = file.s3KeyThumb || file.cdnUrl;
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(file.cdnUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy URL:', file.cdnUrl);
    }
  };

  const download = () => {
    const a = document.createElement('a');
    a.href = file.cdnUrl;
    a.download = file.filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (viewMode === 'list') {
    return (
      <div className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-2 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800">
        {selectMode && (
          <button onClick={onToggleSelect} className="flex-shrink-0">
            {selected ? (
              <CheckSquare className="h-5 w-5 text-blue-500" />
            ) : (
              <Square className="h-5 w-5 text-slate-300" />
            )}
          </button>
        )}
        <img
          src={thumbUrl}
          alt={file.filename}
          className="h-10 w-10 cursor-pointer rounded object-cover"
          onClick={onPreview}
        />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
            {file.filename}
          </p>
          <p className="text-xs text-slate-500">
            {formatBytes(file.fileSizeBytes)}
            {file.width && file.height && ` · ${file.width}×${file.height}`}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={copyUrl} title="Copy URL" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button onClick={download} title="Download" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={onDelete} title="Delete" className="rounded p-1.5 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      {selectMode && (
        <button
          onClick={onToggleSelect}
          className="absolute left-2 top-2 z-10 rounded bg-white/90 p-1 shadow-sm dark:bg-slate-700/90"
        >
          {selected ? (
            <CheckSquare className="h-5 w-5 text-blue-500" />
          ) : (
            <Square className="h-5 w-5 text-slate-300" />
          )}
        </button>
      )}
      <div
        className={`aspect-square overflow-hidden rounded-xl border bg-slate-100 dark:bg-slate-700 cursor-pointer ${
          selected
            ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
            : 'border-slate-200 dark:border-slate-700'
        }`}
        onClick={selectMode ? onToggleSelect : onPreview}
      >
        <OptimizedImage
          src={file.cdnUrl}
          alt={file.filename}
          variant="small"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="mt-1 px-1">
        <p className="truncate text-xs text-slate-600 dark:text-slate-400">
          {file.filename}
        </p>
      </div>
      {/* Actions overlay */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyUrl();
          }}
          title="Copy URL"
          className="rounded bg-white/90 p-1.5 text-slate-600 shadow-sm hover:bg-white dark:bg-slate-700/90 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            download();
          }}
          title="Download"
          className="rounded bg-white/90 p-1.5 text-slate-600 shadow-sm hover:bg-white dark:bg-slate-700/90 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
          className="rounded bg-white/90 p-1.5 text-red-500 shadow-sm hover:bg-white dark:bg-slate-700/90 dark:hover:bg-slate-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Create Folder Modal ─────────────────────────────────────

function CreateFolderModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, partNumber?: string) => void;
}) {
  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          New Folder
        </h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Folder Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brakes, ABC-12345"
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Link to Part Number (optional)
            </label>
            <input
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="e.g. BK-2024-A"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <p className="mt-1 text-xs text-slate-500">
              Listings with this part number will auto-attach images from this folder
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onCreate(name, partNumber || undefined)}
            disabled={!name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Modal ────────────────────────────────────────────

function UploadModal({
  folderId,
  folderName,
  onClose,
  onUploaded,
}: {
  folderId: string | null;
  folderName: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<ImageDriveFolderFile[]>([]);
  const [isFolderUpload, setIsFolderUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFolderName, setAutoFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    (files: ImageDriveFolderFile[]) => {
      if (files.length === 0) {
        setError('No supported image files were found in that selection.');
        return;
      }
      const folderSelection = files.some((item) => /[\\/]/.test(item.relativePath));
      if (folderId && folderSelection) {
        setError('Folder-tree uploads must start from the Image Drive root.');
        return;
      }
      setPendingFiles(files);
      setIsFolderUpload(folderSelection);
      setError(null);
      if (!autoFolderName && !folderId) {
        setAutoFolderName(
          folderSelection
            ? getImageDriveRootFolderName(files)
            : files[0].file.name
                .replace(/\.[^.]+$/, '')
                .replace(/[^a-zA-Z0-9\-_ ]/g, ''),
        );
      }
    },
    [autoFolderName, folderId],
  );

  const handleUpload = useCallback(async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    try {
      if (folderId) {
        await uploadToFolder(
          folderId,
          pendingFiles.map((item) => item.file),
          setProgress,
        );
      } else if (isFolderUpload) {
        await uploadFolder(pendingFiles, setProgress);
      } else {
        if (!autoFolderName.trim()) return;
        await uploadAutoCreate(
          autoFolderName,
          pendingFiles.map((item) => item.file),
          undefined,
          setProgress,
        );
      }
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [folderId, autoFolderName, isFolderUpload, pendingFiles, onUploaded]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          {folderId ? `Upload to ${folderName}` : 'Upload Images'}
        </h2>

        {!folderId && (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Folder Name
            </label>
            {isFolderUpload ? (
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {autoFolderName} · part-number subfolders will be linked automatically
              </p>
            ) : (
              <input
                value={autoFolderName}
                onChange={(e) => setAutoFolderName(e.target.value)}
                placeholder="Enter folder name for auto-create"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            )}
          </div>
        )}

        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-300 dark:border-slate-600'
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void collectDroppedImageDriveFiles(e.dataTransfer)
              .then(handleFiles)
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Unable to read that folder.');
              });
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Drag and drop images here or click to browse
            {!folderId && ' · folders are supported from the root'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(toImageDriveFolderFiles(e.target.files));
              e.target.value = '';
            }}
          />
          {!folderId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                folderInputRef.current?.click();
              }}
              className="mt-3 rounded border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-700 dark:text-blue-300"
            >
              Choose a folder
            </button>
          )}
          {!folderId && (
            <input
              ref={(element) => {
                folderInputRef.current = element;
                element?.setAttribute('webkitdirectory', '');
                element?.setAttribute('directory', '');
              }}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(toImageDriveFolderFiles(e.target.files));
                e.target.value = '';
              }}
            />
          )}
        </div>

        {pendingFiles.length > 0 && (
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {pendingFiles.length} image(s) selected
            {isFolderUpload && ' · part-number subfolders will be linked automatically'}
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {uploading && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{progress}%</p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={pendingFiles.length === 0 || uploading || (!folderId && !autoFolderName.trim())}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : `Upload ${pendingFiles.length} file(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root Drop Zone (auto-create folder) ─────────────────────

function RootDropZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<ImageDriveFolderFile[]>([]);
  const [isFolderUpload, setIsFolderUpload] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    (files: ImageDriveFolderFile[]) => {
      if (files.length === 0) {
        setError('No supported image files were found in that selection.');
        return;
      }

      const folderSelection = files.some((item) => /[\\/]/.test(item.relativePath));
      setPendingFiles(files);
      setIsFolderUpload(folderSelection);
      setError(null);
      setFolderName(
        folderSelection
          ? getImageDriveRootFolderName(files)
          : files[0].file.name
              .replace(/\.[^.]+$/, '')
              .replace(/[^a-zA-Z0-9\-_ ]/g, ''),
      );
    },
    [],
  );

  const handleDroppedFiles = useCallback(
    async (dataTransfer: DataTransfer) => {
      try {
        handleFiles(await collectDroppedImageDriveFiles(dataTransfer));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to read that folder.');
      }
    },
    [handleFiles],
  );

  const handleUpload = useCallback(async () => {
    if (pendingFiles.length === 0 || !folderName.trim()) return;
    setUploading(true);
    setError(null);
    try {
      if (isFolderUpload) {
        await uploadFolder(pendingFiles, setProgress);
      } else {
        await uploadAutoCreate(
          folderName,
          pendingFiles.map((item) => item.file),
          undefined,
          setProgress,
        );
      }
      setPendingFiles([]);
      setIsFolderUpload(false);
      setFolderName('');
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [folderName, isFolderUpload, pendingFiles, onUploaded]);

  if (pendingFiles.length === 0) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-40 border-t-2 border-dashed transition ${
          dragOver
            ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-900/30'
            : 'border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-800/90'
        }`}>
        <div
          className="flex flex-wrap items-center justify-center gap-3 px-4 py-3"
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleDroppedFiles(e.dataTransfer);
          }}
        >
          <Upload className={`h-4 w-4 ${dragOver ? 'text-blue-600' : 'text-slate-400'}`} />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {dragOver ? 'Drop the folder or images to upload' : 'Drop images or a folder here'}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Choose files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="rounded border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
          >
            Choose folder
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(toImageDriveFolderFiles(e.target.files));
              e.target.value = '';
            }}
          />
          <input
            ref={(element) => {
              folderInputRef.current = element;
              element?.setAttribute('webkitdirectory', '');
              element?.setAttribute('directory', '');
            }}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(toImageDriveFolderFiles(e.target.files));
              e.target.value = '';
            }}
          />
          {error && (
            <p className="basis-full text-center text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4">
        <div className="min-w-56 flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {isFolderUpload ? 'Folder upload' : 'Folder name for these images'}
          </label>
          {isFolderUpload ? (
            <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {folderName} · part-number subfolders will be linked automatically
            </p>
          ) : (
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name"
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
            />
          )}
        </div>
        <div className="text-sm text-slate-500">
          {pendingFiles.length} image{pendingFiles.length === 1 ? '' : 's'}
        </div>
        {uploading && (
          <div className="w-32">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">{progress}%</p>
          </div>
        )}
        <button
          onClick={handleUpload}
          disabled={!folderName.trim() || uploading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : isFolderUpload ? 'Upload folder' : 'Upload'}
        </button>
        <button
          onClick={() => {
            setPendingFiles([]);
            setIsFolderUpload(false);
            setFolderName('');
            setError(null);
          }}
          className="rounded p-1.5 text-slate-400 hover:text-slate-600"
          disabled={uploading}
        >
          <X className="h-4 w-4" />
        </button>
        {error && (
          <p className="basis-full text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
