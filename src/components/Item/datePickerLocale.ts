import { moment } from "obsidian";
import l10n from "flatpickr/dist/l10n";
import { CustomLocale } from "flatpickr/dist/types/locale";

const momentLocale = moment.locale();

const localeMap: { [k: string]: CustomLocale } = {
  ar: l10n.ar,
  cz: l10n.cs,
  da: l10n.da,
  de: l10n.de,
  en: l10n.en,
  es: l10n.es,
  fr: l10n.fr,
  hi: l10n.hi,
  id: l10n.id,
  it: l10n.it,
  ja: l10n.ja,
  ko: l10n.ko,
  nl: l10n.nl,
  no: l10n.no,
  pl: l10n.pl,
  pt: l10n.pt,
  "pt-BR": l10n.pt,
  ro: l10n.ro,
  ru: l10n.ru,
  tr: l10n.tr,
  zh: l10n.zh,
  "zh-TW": l10n.zh_tw,
};

export function getDefaultLocale() {
  return localeMap[momentLocale];
}
