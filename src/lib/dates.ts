import { format, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';

export const toDateISO = (d: Date) => format(d, 'yyyy-MM-dd');
export const todayISO = () => toDateISO(new Date());
export const parseDate = (iso: string) => parseISO(iso);

export const formatDayRu = (iso: string) => format(parseISO(iso), 'EEEE, d MMMM', { locale: ru });
export const formatShortRu = (iso: string) => format(parseISO(iso), 'd MMM', { locale: ru });
export const formatMonthRu = (iso: string) => format(parseISO(iso), 'LLLL yyyy', { locale: ru });

export const weekRange = (iso: string) => {
  const d = parseISO(iso);
  return {
    start: toDateISO(startOfWeek(d, { weekStartsOn: 1 })),
    end: toDateISO(endOfWeek(d, { weekStartsOn: 1 })),
  };
};

export const addDaysISO = (iso: string, n: number) => toDateISO(addDays(parseISO(iso), n));

export const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const greetingRu = (hour: number) =>
  hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
