import { moment } from 'obsidian';

import { buildLangNormalizer } from './normalizeLang';
import ar from './locale/ar';
import cz from './locale/cz';
import da from './locale/da';
import de from './locale/de';
import en, { Lang } from './locale/en';
import es from './locale/es';
import fr from './locale/fr';
import hi from './locale/hi';
import id from './locale/id';
import it from './locale/it';
import ja from './locale/ja';
import ko from './locale/ko';
import nl from './locale/nl';
import no from './locale/no';
import pl from './locale/pl';
import pt from './locale/pt';
import ptBR from './locale/pt-br';
import ro from './locale/ro';
import ru from './locale/ru';
import sq from './locale/sq';
import tr from './locale/tr';
import uk from './locale/uk';
import zhCN from './locale/zh-cn';
import zhTW from './locale/zh-tw';

const localeMap: { [k: string]: Partial<Lang> } = {
  ar,
  cz,
  da,
  de,
  en,
  es,
  fr,
  hi,
  id,
  it,
  ja,
  ko,
  nl,
  no,
  pl,
  'pt-BR': ptBR,
  pt,
  ro,
  ru,
  sq,
  tr,
  uk,
  'zh-TW': zhTW,
  zh: zhCN,
};

// 界面语言检测：moment.locale() 是 Obsidian 官方提供的入口，始终反映
// 当前界面语言；localStorage 'language' 是旧版 Obsidian 的实现细节，
// 仅部分版本写入，作为兜底保留。
const normalizeLang = buildLangNormalizer(Object.keys(localeMap));
const lang =
  normalizeLang(moment.locale()) ??
  normalizeLang(window.localStorage.getItem('language')) ??
  'en';
const locale = localeMap[lang];

export function t(str: keyof typeof en): string {
  if (!locale) {
    console.error('Error: kanban locale not found', lang);
  }

  return (locale && locale[str]) || en[str];
}
