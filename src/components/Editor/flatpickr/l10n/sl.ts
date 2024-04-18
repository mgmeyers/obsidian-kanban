import { FlatpickrFn } from '../types/instance';

/* Slovenian locals for flatpickr */
import { CustomLocale } from '../types/locale';

const fp =
  typeof window !== 'undefined' && (window as any).flatpickr !== undefined
    ? (window as any).flatpickr
    : ({
        l10ns: {},
      } as FlatpickrFn);

export const Slovenian: CustomLocale = {
  weekdays: {
    shorthand: ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'],
    longhand: ['Nedelja', 'Ponedeljek', 'Torek', 'Sreda', 'Četrtek', 'Petek', 'Sobota'],
  },

  months: {
    shorthand: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'],
    longhand: [
      'Januar',
      'Februar',
      'Marec',
      'April',
      'Maj',
      'Junij',
      'Julij',
      'Avgust',
      'September',
      'Oktober',
      'November',
      'December',
    ],
  },

  firstDayOfWeek: 1,
  rangeSeparator: ' do ',
  time_24hr: true,
  ordinal: function () {
    return '.';
  },
};

fp.l10ns.sl = Slovenian;

export default fp.l10ns;
