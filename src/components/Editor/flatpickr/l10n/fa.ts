import { FlatpickrFn } from '../types/instance';
/* Farsi (Persian) locals for flatpickr */
import { CustomLocale } from '../types/locale';

const fp =
  typeof window !== 'undefined' && (window as any).flatpickr !== undefined
    ? (window as any).flatpickr
    : ({
        l10ns: {},
      } as FlatpickrFn);

export const Persian: CustomLocale = {
  weekdays: {
    shorthand: ['یک', 'دو', 'سه', 'چهار', 'پنج', 'جمعه', 'شنبه'],
    longhand: [
      'یک‌شنبه',
      'دوشنبه',
      'سه‌شنبه',
      'چهارشنبه',
      'پنچ‌شنبه',
      'جمعه',
      'شنبه',
    ],
  },

  months: {
    shorthand: [
      'ژانویه',
      'فوریه',
      'مارس',
      'آوریل',
      'مه',
      'ژوئن',
      'ژوئیه',
      'اوت',
      'سپتامبر',
      'اکتبر',
      'نوامبر',
      'دسامبر',
    ],
    longhand: [
      'ژانویه',
      'فوریه',
      'مارس',
      'آوریل',
      'مه',
      'ژوئن',
      'ژوئیه',
      'اوت',
      'سپتامبر',
      'اکتبر',
      'نوامبر',
      'دسامبر',
    ],
  },
  firstDayOfWeek: 6,
  ordinal: () => {
    return '';
  },
};

fp.l10ns.fa = Persian;

export default fp.l10ns;
