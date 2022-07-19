import { FlatpickrFn } from '../types/instance';
/* Malaysian locals for flatpickr */
import { CustomLocale } from '../types/locale';

const fp =
  typeof window !== 'undefined' && (window as any).flatpickr !== undefined
    ? (window as any).flatpickr
    : ({
        l10ns: {},
      } as FlatpickrFn);

export const Malaysian: CustomLocale = {
  weekdays: {
    shorthand: ['Aha', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'],
    longhand: ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'],
  },

  months: {
    shorthand: [
      'Jan',
      'Feb',
      'Mac',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Ogo',
      'Sep',
      'Okt',
      'Nov',
      'Dis',
    ],
    longhand: [
      'Januari',
      'Februari',
      'Mac',
      'April',
      'Mei',
      'Jun',
      'Julai',
      'Ogos',
      'September',
      'Oktober',
      'November',
      'Disember',
    ],
  },

  firstDayOfWeek: 1,

  ordinal: () => {
    return '';
  },
};

export default fp.l10ns;
