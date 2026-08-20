export interface ImageDriveFolderFile {
  file: File;
  relativePath: string;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

interface FileSystemFileEntryLike extends FileSystemEntryLike {
  file: (
    success: (file: File) => void,
    error?: (error: DOMException) => void,
  ) => void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (error: DOMException) => void,
    ) => void;
  };
}

function isSupportedImage(file: File): boolean {
  if (file.type.toLowerCase().startsWith('image/')) return true;
  return /\.(avif|bmp|gif|heic|jpeg|jpg|png|tif|tiff|webp)$/i.test(file.name);
}

export function toImageDriveFolderFiles(
  files: FileList | File[],
): ImageDriveFolderFile[] {
  return Array.from(files)
    .filter(isSupportedImage)
    .map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }));
}

function readFileEntry(
  entry: FileSystemFileEntryLike,
  pathPrefix: string,
): Promise<ImageDriveFolderFile | null> {
  return new Promise((resolve, reject) => {
    entry.file(
      (file) => {
        if (!isSupportedImage(file)) {
          resolve(null);
          return;
        }
        resolve({ file, relativePath: `${pathPrefix}${entry.name}` });
      },
      reject,
    );
  });
}

async function readDirectoryEntry(
  entry: FileSystemDirectoryEntryLike,
  pathPrefix: string,
): Promise<ImageDriveFolderFile[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntryLike[] = [];

  // Chromium returns directory entries in batches and signals completion with
  // an empty batch, so a single readEntries() call would lose nested files.
  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) break;
    entries.push(...batch);
  }

  const nested = await Promise.all(
    entries.map((child) => {
      const childPrefix = `${pathPrefix}${entry.name}/`;
      if (child.isDirectory) {
        return readDirectoryEntry(
          child as FileSystemDirectoryEntryLike,
          childPrefix,
        );
      }
      if (child.isFile) {
        return readFileEntry(child as FileSystemFileEntryLike, childPrefix);
      }
      return [];
    }),
  );

  return nested.flat().filter(
    (item): item is ImageDriveFolderFile => item !== null,
  );
}

/** Recursively read folders dropped from the desktop in Chromium browsers. */
export async function collectDroppedImageDriveFiles(
  dataTransfer: DataTransfer,
): Promise<ImageDriveFolderFile[]> {
  const items = Array.from(dataTransfer.items);
  const entries = items
    .map((item) => {
      const getEntry = (
        item as unknown as {
          webkitGetAsEntry?: () => FileSystemEntryLike | null;
        }
      ).webkitGetAsEntry;
      return getEntry?.() ?? null;
    })
    .map((entry) => entry as FileSystemEntryLike | null)
    .filter((entry): entry is FileSystemEntryLike => Boolean(entry));

  if (entries.length === 0) return toImageDriveFolderFiles(dataTransfer.files);

  const results = await Promise.all(
    entries.map((entry) => {
      if (entry.isDirectory) {
        return readDirectoryEntry(
          entry as FileSystemDirectoryEntryLike,
          '',
        );
      }
      if (entry.isFile) {
        return readFileEntry(entry as FileSystemFileEntryLike, '');
      }
      return [];
    }),
  );

  return results.flat().filter(
    (item): item is ImageDriveFolderFile => item !== null,
  );
}

export function getImageDriveRootFolderName(
  files: ImageDriveFolderFile[],
): string {
  return files[0]?.relativePath.split(/[\\/]/)[0]?.trim() || 'Folder Upload';
}
