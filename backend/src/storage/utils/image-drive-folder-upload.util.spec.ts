import {
  isLikelyPartNumberFolderName,
  isSupportedImageUpload,
  normalizeFolderUploadPath,
  resolveFolderUploadPath,
} from './image-drive-folder-upload.util.js';

describe('image-drive-folder-upload.util', () => {
  it('normalizes browser paths and rejects traversal', () => {
    expect(normalizeFolderUploadPath('Parts\\12345\\front image.jpg')).toBe(
      'Parts/12345/front image.jpg',
    );
    expect(normalizeFolderUploadPath('../outside/image.jpg')).toBeNull();
    expect(normalizeFolderUploadPath('/absolute/image.jpg')).toBeNull();
  });

  it('recognizes common part-number directory names but not containers', () => {
    expect(isLikelyPartNumberFolderName('6L2Z-17K707-AA')).toBe(true);
    expect(isLikelyPartNumberFolderName('12345')).toBe(true);
    expect(isLikelyPartNumberFolderName('photos')).toBe(false);
    expect(isLikelyPartNumberFolderName('front')).toBe(false);
  });

  it('uses the deepest part-number folder and preserves nested image paths', () => {
    expect(
      resolveFolderUploadPath(
        'Incoming/12345/67890/angle/front.jpg',
        'Incoming',
      ),
    ).toEqual({
      relativePath: 'Incoming/12345/67890/angle/front.jpg',
      topLevelFolderName: 'Incoming',
      partNumber: '67890',
      assetPath: 'angle/front.jpg',
    });
  });

  it('keeps unmatched files under the upload root', () => {
    expect(resolveFolderUploadPath('Incoming/photos/front.jpg')).toEqual({
      relativePath: 'Incoming/photos/front.jpg',
      topLevelFolderName: 'Folder Upload',
      partNumber: null,
      assetPath: 'photos/front.jpg',
    });
  });

  it('accepts image MIME types and supported image extensions', () => {
    expect(isSupportedImageUpload('photo.bin', 'image/jpeg')).toBe(true);
    expect(isSupportedImageUpload('photo.webp', '')).toBe(true);
    expect(isSupportedImageUpload('notes.txt', 'text/plain')).toBe(false);
  });
});
