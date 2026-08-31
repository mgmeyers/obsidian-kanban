// 将任意语言标识（moment.locale() 或 localStorage 中的值）归一化到
// localeMap 的某个键，未匹配时返回 null。
// moment.locale() 返回 'zh-cn'、'zh-tw'、'en' 这类小写形式；
// localStorage 'language' 键返回 'zh'、'en-gb' 这类形式。

// 脚本变体别名：moment/Obsidian 不使用这些值，但用户环境可能传来
const ALIASES: Record<string, string> = {
  'zh-hans': 'zh-cn',
  'zh-sg': 'zh-cn',
  'zh-hant': 'zh-tw',
  'zh-hk': 'zh-tw',
  'zh-mo': 'zh-tw',
};

export function buildLangNormalizer(
  availableKeys: readonly string[]
): (raw: string | null | undefined) => string | null {
  // 精确表：键的小写形式 -> 原键（'zh-tw' -> 'zh-TW'）
  const exact = new Map<string, string>();
  // 前缀表：主语言代码 -> 默认键（'zh' -> 'zh'，'en' -> 'en'）
  const prefix = new Map<string, string>();

  for (const key of availableKeys) {
    const lower = key.toLowerCase();
    if (!exact.has(lower)) exact.set(lower, key);
  }
  // 先由不带区域的裸键建立前缀默认，避免 'zh-TW' 之类区域键反向覆盖 'zh'
  for (const key of availableKeys) {
    const lower = key.toLowerCase();
    if (!lower.includes('-')) prefix.set(lower, key);
  }
  // 某语言只有区域键时（如仅有 pt-BR），用区域键补上该前缀
  for (const key of availableKeys) {
    const p = key.toLowerCase().split('-')[0];
    if (!prefix.has(p)) prefix.set(p, key);
  }

  return (raw) => {
    if (!raw) return null;
    const aliased = ALIASES[raw.toLowerCase()] ?? raw;
    const lower = aliased.toLowerCase();
    return exact.get(lower) ?? prefix.get(lower.split('-')[0]) ?? null;
  };
}
