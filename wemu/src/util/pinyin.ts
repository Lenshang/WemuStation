// Pinyin-initial search helper. pinyin-pro (~500KB with its dictionary) is
// lazy-imported on first use so the main bundle stays small; the search panel
// is the only consumer.
type PinyinFn = (s: string) => string;

let fn: PinyinFn | null = null;
let loading: Promise<PinyinFn> | null = null;

export function ensurePinyin(): Promise<PinyinFn> {
  if (fn) return Promise.resolve(fn);
  if (!loading) {
    loading = import('pinyin-pro').then((mod) => {
      fn = (s: string) => {
        try {
          // 'first' = initial letters (拳皇 -> qh), non-Chinese kept as-is
          return mod.pinyin(s, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('');
        } catch {
          return '';
        }
      };
      return fn;
    });
  }
  return loading;
}

/** Initials for the given string; '' until ensurePinyin() resolved. */
export function initials(s: string): string {
  return fn ? fn(s) : '';
}
