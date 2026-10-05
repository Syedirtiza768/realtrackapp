import {
  normalizeImageIntakePartName,
  parseInstanceFolderName,
  partFolderFromRelativePath,
  safeIntakePath,
} from './business-industrial-image-intake.util.js';

describe('Business & Industrial image intake folder rules', () => {
  it('treats a final numeric dot suffix as an instance marker', () => {
    expect(parseInstanceFolderName('BNI-20')).toEqual({
      rawFolderName: 'BNI-20',
      baseFolderName: 'BNI-20',
      instanceSuffix: null,
    });
    expect(parseInstanceFolderName('BNI-20.1')).toEqual({
      rawFolderName: 'BNI-20.1',
      baseFolderName: 'BNI-20',
      instanceSuffix: '1',
    });
    expect(parseInstanceFolderName(' Valve.2 ')).toEqual({
      rawFolderName: 'Valve.2',
      baseFolderName: 'Valve',
      instanceSuffix: '2',
    });
  });

  it('normalizes equivalent base names for grouping', () => {
    expect(normalizeImageIntakePartName('BNI-20')).toBe('bni20');
    expect(normalizeImageIntakePartName(' BNI 20 ')).toBe('bni20');
  });

  it('finds the first part folder below the selected root', () => {
    expect(
      partFolderFromRelativePath('Parts/BNI-20.1/photo.jpg', 'Parts'),
    ).toBe('BNI-20.1');
    expect(partFolderFromRelativePath('BNI-20/photo.jpg', 'Parts')).toBe(
      'BNI-20',
    );
    expect(
      partFolderFromRelativePath('Parts/BNI-20/side/photo.jpg', 'Parts'),
    ).toBe('BNI-20');
  });

  it('rejects traversal and absolute paths', () => {
    expect(() => safeIntakePath('../photo.jpg')).toThrow('Invalid image path');
    expect(() => safeIntakePath('C:/photo.jpg')).toThrow('Invalid image path');
    expect(safeIntakePath('Parts/BNI-20/photo.jpg')).toBe(
      'Parts/BNI-20/photo.jpg',
    );
  });
});
