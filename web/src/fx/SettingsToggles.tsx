import { updateSettings, useSettings } from '../settings';
import type { MotionSetting } from '../logic/motion';

export function SettingsToggles() {
  const s = useSettings();
  return (
    <div className="settings" role="group" aria-label="Preferencias visuales">
      <label className="settings__item" htmlFor="set-crt">
        <input
          id="set-crt"
          type="checkbox"
          checked={s.crt}
          onChange={(e) => updateSettings({ crt: e.target.checked })}
        />
        <span>Filtro CRT</span>
      </label>
      <div className="settings__item">
        <label htmlFor="set-motion">Animaciones</label>
        <select
          id="set-motion"
          value={s.motion}
          onChange={(e) => updateSettings({ motion: e.target.value as MotionSetting })}
        >
          <option value="auto">Según el sistema</option>
          <option value="reduced">Reducidas</option>
          <option value="full">Completas</option>
        </select>
      </div>
    </div>
  );
}
