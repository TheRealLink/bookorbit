import { compareArchiveEntryNames, isArchiveImageFile, isHiddenArchivePath } from './archive-image-utils';

describe('archive-image-utils', () => {
  it('detects supported image file extensions case-insensitively', () => {
    expect(isArchiveImageFile('cover.JPG')).toBe(true);
    expect(isArchiveImageFile('folder/page.png')).toBe(true);
  });

  it('returns false for non-image or extensionless entries', () => {
    expect(isArchiveImageFile('metadata.txt')).toBe(false);
    expect(isArchiveImageFile('cover')).toBe(false);
  });

  it('detects hidden paths in nested archive entries', () => {
    expect(isHiddenArchivePath('.hidden.jpg')).toBe(true);
    expect(isHiddenArchivePath('folder/.hidden/page.jpg')).toBe(true);
    expect(isHiddenArchivePath('folder/page.jpg')).toBe(false);
  });

  it('sorts archive entries by natural filename order', () => {
    const entries = ['page10.jpg', 'Page1.JPG', 'page2.jpg'];
    expect(entries.toSorted(compareArchiveEntryNames)).toEqual(['Page1.JPG', 'page2.jpg', 'page10.jpg']);
  });

  it.each(['', 'comic/'])('sorts a filename before suffixed pages in folder "%s"', (folder) => {
    const entries = [`${folder}IMG_0004_Seite_001_1L.jpg`, `${folder}IMG.jpg`];
    expect(entries.toSorted(compareArchiveEntryNames)).toEqual([`${folder}IMG.jpg`, `${folder}IMG_0004_Seite_001_1L.jpg`]);
  });

  it('sorts page stems naturally regardless of image extension', () => {
    const entries = ['page10.png', 'page2.jpg', 'page.webp', 'page1.JPG'];
    expect(entries.toSorted(compareArchiveEntryNames)).toEqual(['page.webp', 'page1.JPG', 'page2.jpg', 'page10.png']);
  });

  it('uses the full filename to break ties between identical stems', () => {
    const entries = ['IMG.png', 'IMG.jpg'];
    expect(entries.toSorted(compareArchiveEntryNames)).toEqual(['IMG.jpg', 'IMG.png']);
  });
});
