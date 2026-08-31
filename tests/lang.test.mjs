// 语言模块契约测试：
// 1. normalizeLang 归一化契约（esbuild 编译纯函数后断言）
// 2. 翻译完整性契约（各语言文件键必须 ⊆ en.ts 键；zh-cn.ts 必须全覆盖）
// 运行：npm test（node tests/lang.test.mjs）
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let failed = 0;
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ---------- 1. normalizeLang 契约 ----------

const LOCALE_KEYS = [
  'ar', 'cz', 'da', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko',
  'nl', 'no', 'pl', 'pt', 'pt-BR', 'ro', 'ru', 'sq', 'tr', 'uk', 'zh', 'zh-TW',
];

const outDir = mkdtempSync(join(tmpdir(), 'kanban-lang-test-'));
await build({
  entryPoints: ['src/lang/normalizeLang.ts'],
  bundle: true,
  format: 'esm',
  outfile: join(outDir, 'normalizeLang.mjs'),
  logLevel: 'silent',
});
const { buildLangNormalizer } = await import(
  pathToFileURL(join(outDir, 'normalizeLang.mjs'))
);
const normalize = buildLangNormalizer(LOCALE_KEYS);

const cases = [
  // 简中：裸键与各种区域/别名形式都归一到 zh
  ['zh', 'zh'],
  ['zh-cn', 'zh'],
  ['zh-CN', 'zh'],
  ['zh-hans', 'zh'],
  ['zh-sg', 'zh'],
  // 繁中：精确与别名归一到 zh-TW
  ['zh-TW', 'zh-TW'],
  ['zh-tw', 'zh-TW'],
  ['zh-hant', 'zh-TW'],
  ['zh-hk', 'zh-TW'],
  // 英语：区域后缀回落裸键
  ['en', 'en'],
  ['en-gb', 'en'],
  ['en-US', 'en'],
  // 葡语：区域精确命中
  ['pt', 'pt'],
  ['pt-br', 'pt-BR'],
  ['pt-BR', 'pt-BR'],
  // 大小写不敏感
  ['DE', 'de'],
  ['ja', 'ja'],
  // 未知语言 / 空值
  ['xx', null],
  ['sr-Latn', null],
  ['', null],
  [null, null],
  [undefined, null],
];

for (const [input, expected] of cases) {
  test(`normalize(${JSON.stringify(input)}) === ${JSON.stringify(expected)}`, () => {
    assert.equal(normalize(input), expected);
  });
}

// ---------- 2. 翻译完整性契约 ----------

const LOCALE_DIR = 'src/lang/locale';

function extractKeys(path) {
  const keys = new Set();
  const lines = readFileSync(path, 'utf-8').split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('//') || line.startsWith('*')) continue;
    let m = line.match(/^'([^']+)':/) || line.match(/^"([^"]+)":/);
    if (m) {
      keys.add(m[1]);
      continue;
    }
    m = line.match(/^([A-Za-z_$][A-Za-z0-9_$]*):/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

const enKeys = extractKeys(join(LOCALE_DIR, 'en.ts'));

const localeFiles = readdirSync(LOCALE_DIR).filter(
  (f) => f.endsWith('.ts') && f !== 'en.ts'
);
for (const file of localeFiles) {
  const keys = extractKeys(join(LOCALE_DIR, file));
  const extra = [...keys].filter((k) => !enKeys.has(k));
  test(`${file} 不含 en.ts 之外的键`, () => {
    assert.deepEqual(extra, [], `多余键: ${extra.join(', ')}`);
  });
}

test('zh-cn.ts 覆盖 en.ts 全部键（缺失数为 0）', () => {
  const zhKeys = extractKeys(join(LOCALE_DIR, 'zh-cn.ts'));
  const missing = [...enKeys].filter((k) => !zhKeys.has(k));
  assert.deepEqual(missing, [], `缺失 ${missing.length} 个键`);
});

// ---------- 运行 ----------

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${name}\n      ${e.message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} 通过`);
process.exit(failed ? 1 : 0);
