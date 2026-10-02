import { useState } from 'react';
import { EFFECTS_KEY, effectsEnabled } from './Burst';
import { Switch } from './Switch';

/** Переключатель «Праздничные эффекты» (конфетти). По умолчанию выключен; выбор хранится в `ikigai.effects`. */
export function EffectsSwitch() {
  const [on, setOn] = useState(effectsEnabled);
  return (
    <Switch
      checked={on}
      aria-label="Праздничные эффекты"
      onChange={next => {
        setOn(next);
        try {
          localStorage.setItem(EFFECTS_KEY, next ? 'on' : 'off');
        } catch {
          /* приватный режим — выбор просто не запомнится */
        }
      }}
    />
  );
}
