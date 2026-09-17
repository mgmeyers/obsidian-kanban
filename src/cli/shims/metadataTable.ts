/**
 * Stub for `src/components/Item/MetadataTable`. The real module is a preact
 * component that imports `obsidian-dataview`, which fails to load outside
 * Obsidian. `src/parsers/common.ts` imports only `anyToString` from it, and
 * that is reached solely from `getSearchValue` during hydration, which the CLI
 * skips.
 */
export function anyToString(v: any): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(anyToString).join(' ');
  return `${v}`;
}
