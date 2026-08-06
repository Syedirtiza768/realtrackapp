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
} from 'lucide-react';
import {
  listFolders,
  createFolder,
  deleteFolder,
  updateFolder,
  listFiles,
  uploadToFolder,
  uploadAutoCreate,
  deleteFile,
  getDriveStats,
  type DriveFolderEntry,
  type DriveFileEntry,
} from '../../lib/imageDriveApi';
import OptimizedImage from '../ui/OptimizedImage';

type ViewMode = 'grid' | 'list';
type BreadcrumbItem = { id: string | null; name: string };

export default function ImageDrivePage() {
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
    enabled: currentFolderId === null,
  });

  const { data: fileList, isLoading: filesLoading } = useQuery({
    queryKey: ['image-drive-files', currentFolderId],
    queryFn: () => listFiles(currentFolderId!, 1, 200),
    enabled: currentFolderId !== null,
  });

  const navigateToFolder = useCallback(
    (folder: DriveFolderEntry) => {
      setCurrentFolderId(folder.id);
      setCurrentFolderName(folder.name);
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
    setBreadcrumbs([{ id: null, name: 'Image Drive' }]);
  }, []);

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
          <button
            onClick={() => setShowCreateFolder(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          {currentFolderId && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
          )}
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
        {/* Root: show folders */}
        {currentFolderId === null && (
          <FolderGrid
            folders={folders}
            loading={foldersLoading}
            viewMode={viewMode}
            onOpen={navigateToFolder}
            onDelete={(id) => {
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
          <FileGrid
            files={fileList?.items ?? []}
            loading={filesLoading}
            viewMode={viewMode}
            folderName={currentFolderName}
            onDelete={(id) => {
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
          />
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
      {showUpload && currentFolderId && (
        <UploadModal
          folderId={currentFolderId}
          folderName={currentFolderName}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            queryClient.invalidateQueries({
              queryKey: ['image-drive-files', currentFolderId],
            });
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

      {/* Drag-drop zone at root for auto-create */}
      {currentFolderId === null && (
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
  onDelete,
}: {
  files: DriveFileEntry[];
  loading: boolean;
  viewMode: ViewMode;
  folderName: string;
  onDelete: (id: string) => void;
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
          onDelete={() => onDelete(file.id)}
        />
      ))}
    </div>
  );
}

// ─── File Card ───────────────────────────────────────────────

function FileCard({
  file,
  viewMode,
  onDelete,
}: {
  file: DriveFileEntry;
  viewMode: ViewMode;
  onDelete: () => void;
}) {
  const thumbUrl = file.s3KeyThumb || file.cdnUrl;

  if (viewMode === 'list') {
    return (
      <div className="group flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-2 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800">
        <img
          src={thumbUrl}
          alt={file.filename}
          className="h-10 w-10 rounded object-cover"
        />
        <div className="flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
            {file.filename}
          </p>
          <p className="text-xs text-slate-500">
            {formatBytes(file.fileSizeBytes)}
            {file.width && file.height && ` · ${file.width}×${file.height}`}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="rounded p-1.5 text-red-400 opacity-0 hover:bg-red-100 group-hover:opacity-100 dark:hover:bg-red-900/30"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-700">
        <OptimizedImage
          src={file.cdnUrl}
          alt={file.filename}
          variant="medium"
          className="h-full w-full object-cover"
        />
      </div>
      <div className="mt-1 px-1">
        <p className="truncate text-xs text-slate-600 dark:text-slate-400">
          {file.filename}
        </p>
      </div>
      <button
        onClick={onDelete}
        className="absolute right-2 top-2 rounded bg-white/90 p-1.5 text-red-500 opacity-0 shadow-sm transition hover:bg-white group-hover:opacity-100 dark:bg-slate-700/90 dark:hover:bg-slate-700"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
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
  folderId: string;
  folderName: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (arr.length > 0) setPendingFiles(arr);
  }, []);

  const handleUpload = useCallback(async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    try {
      await uploadToFolder(folderId, pendingFiles, setProgress);
      onUploaded();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [folderId, pendingFiles, onUploaded]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
          Upload to {folderName}
        </h2>

        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-300 dark:border-slate-600'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Drag and drop images here or click to browse
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {pendingFiles.length > 0 && (
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {pendingFiles.length} file(s) selected
          </div>
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
            disabled={pendingFiles.length === 0 || uploading}
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (arr.length > 0) {
      setPendingFiles(arr);
      if (!folderName) {
        setFolderName(arr[0].name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9\-_ ]/g, ''));
      }
    }
  }, [folderName]);

  const handleUpload = useCallback(async () => {
    if (pendingFiles.length === 0 || !folderName.trim()) return;
    setUploading(true);
    try {
      await uploadAutoCreate(folderName, pendingFiles, undefined, setProgress);
      setPendingFiles([]);
      setFolderName('');
      onUploaded();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [folderName, pendingFiles, onUploaded]);

  if (pendingFiles.length === 0) {
    return (
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 border-t-2 border-dashed transition ${
          dragOver
            ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-900/30'
            : 'border-transparent'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {dragOver && (
          <div className="flex items-center justify-center py-8">
            <p className="text-lg font-medium text-blue-600">
              Drop files to create a new folder
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <div className="mx-auto flex max-w-3xl items-center gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Folder name
          </label>
          <input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Enter folder name"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
          />
        </div>
        <div className="text-sm text-slate-500">
          {pendingFiles.length} file(s)
        </div>
        {uploading && (
          <div className="w-32">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full bg-blue-600"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        <button
          onClick={handleUpload}
          disabled={!folderName.trim() || uploading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        <button
          onClick={() => {
            setPendingFiles([]);
            setFolderName('');
          }}
          className="rounded p-1.5 text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
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
