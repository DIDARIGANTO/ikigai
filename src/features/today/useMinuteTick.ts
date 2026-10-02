import { useEffect, useState } from 'react';

const floorToMinute = (ms: number) => ms - (ms % 60_000);

/**
 * `Date.now()`, округлённый вниз до минуты, — и перерисовка раз в минуту.
 * Нужен там, где на экране висит «сегодня»: страница, открытая с вечера, должна сама
 * перейти на новый день, а не показывать вчерашний до перезагрузки.
 */
export function useMinuteTick(): number {
  const [minute, setMinute] = useState(() => floorToMinute(Date.now()));

  useEffect(() => {
    const sync = () => setMinute(floorToMinute(Date.now()));
    let interval: number | undefined;
    // Сначала догоняем ближайшую целую минуту, дальше идём ровным шагом.
    const timeout = window.setTimeout(() => {
      sync();
      interval = window.setInterval(sync, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeout);
      if (interval) window.clearInterval(interval);
    };
  }, []);

  return minute;
}
