import { posix } from 'path';

export function compareArchiveEntryNames(a: string, b: string): number {
  const aStem = a.slice(0, a.length - posix.extname(a).length);
  const bStem = b.slice(0, b.length - posix.extname(b).length);
  return (
    aStem.localeCompare(bStem, undefined, { numeric: true, sensitivity: 'base' }) ||
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
}
