/** Полоса «план / факт»: доля заполнения, перерасход и короткая подпись. */
export function planFactBar(planned: number, actual: number) {
  const a = Math.max(0, Math.round(actual));
  const p = Math.max(1, Math.round(planned));
  const over = a > p;
  return {
    fill: over ? 1 : a / p,
    over,
    short: over ? `+${a - p} мин` : `${a}/${p} мин`,
    title: over ? `план ${p} мин · факт ${a} мин, на ${a - p} мин дольше` : `план ${p} мин · факт ${a} мин`,
  };
}
