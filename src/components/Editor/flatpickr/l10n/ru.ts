import { FlatpickrFn } from '../types/instance';
/* Russian locals for flatpickr */
import { CustomLocale } from '../types/locale';

const fp =
  typeof window !== 'undefined' && (window as any).flatpickr !== undefined
    ? (window as any).flatpickr
    : ({
        l10ns: {},
      } as FlatpickrFn);

export const Russian: CustomLocale = {
  weekdays: {
    shorthand: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    longhand: [
      'Воскресенье',
      'Понедельник',
      'Вторник',
      'Среда',
      'Четверг',
      'Пятница',
      'Суббота',
    ],
  },
  months: {
    shorthand: [
      'Янв',
      'Фев',
      'Март',
      'Апр',
      'Май',
      'Июнь',
      'Июль',
      'Авг',
      'Сен',
      'Окт',
      'Ноя',
      'Дек',
    ],
    longhand: [
      'Январь',
      'Февраль',
      'Март',
      'Апрель',
      'Май',
      'Июнь',
      'Июль',
      'Август',
      'Сентябрь',
      'Октябрь',
      'Ноябрь',
      'Декабрь',
    ],
  },
  firstDayOfWeek: 1,
  ordinal: function () {
    return '';
  },
  rangeSeparator: ' — ',
  weekAbbreviation: 'Нед.',
  scrollTitle: 'Прокрутите для увеличения',
  toggleTitle: 'Нажмите для переключения',
  amPM: ['ДП', 'ПП'],
  yearAriaLabel: 'Год',
  time_24hr: true,
};

fp.l10ns.ru = Russian;

export default fp.l10ns;
