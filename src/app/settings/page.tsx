"use client";

import PageSurface from "@/components/PageSurface";
import { usePreferences } from "@/hooks/usePreferences";

const RETRO_OPTIONS = [
  {
    value: "off" as const,
    label: "Off",
    hint: "Clean rendering with no overlay.",
  },
  {
    value: "scanlines" as const,
    label: "Scanline Overlay",
    hint: "Adds a subtle static grid reminiscent of old displays.",
  },
  {
    value: "filter" as const,
    label: "Soft Filter",
    hint: "Gentle contrast shift with a fixed vignette.",
  },
];

export default function SettingsPage() {
  const { state, setRetro, setHighContrast, setTextLarge, setHaptics } = usePreferences();

  return (
    <PageSurface backgroundImage="/backgrounds/tower-bg.png" overlay="linear-gradient(180deg, rgba(10,8,16,0.65), rgba(7,5,12,0.85))">
      <div className="tower-shell">
        <form className="settings-group" aria-labelledby="settings-heading">
          <header>
            <h1 id="settings-heading">Settings</h1>
            <p className="settings-hint">
              Tune the tower for one-handed quests. Preferences persist on this device.
            </p>
          </header>

          <fieldset className="settings-row">
            <legend>Retro treatment</legend>
            <div className="radio-list">
              {RETRO_OPTIONS.map((option) => (
                <label key={option.value} className="radio-item">
                  <input
                    type="radio"
                    name="retro"
                    value={option.value}
                    checked={state.retro === option.value}
                    onChange={() => setRetro(option.value)}
                    aria-describedby={`retro-${option.value}-hint`}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <span id={`retro-${option.value}-hint`} className="settings-hint">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="settings-row">
            <legend>Accessibility</legend>
            <div className="toggle-list">
              <label className="toggle-item">
                <input
                  type="checkbox"
                  name="high-contrast"
                  checked={state.highContrast}
                  onChange={(event) => setHighContrast(event.target.checked)}
                />
                <span>
                  <strong>High contrast</strong>
                  <span className="settings-hint">Boosts contrast for text and panels.</span>
                </span>
              </label>

              <label className="toggle-item">
                <input
                  type="checkbox"
                  name="large-text"
                  checked={state.textLarge}
                  onChange={(event) => setTextLarge(event.target.checked)}
                />
                <span>
                  <strong>Large text</strong>
                  <span className="settings-hint">Raises the base font size for easier reading.</span>
                </span>
              </label>

              <label className="toggle-item">
                <input
                  type="checkbox"
                  name="haptics"
                  checked={state.haptics}
                  onChange={(event) => setHaptics(event.target.checked)}
                />
                <span>
                  <strong>Haptics</strong>
                  <span className="settings-hint">Prep for future tremor feedback. Currently cosmetic.</span>
                </span>
              </label>
            </div>
          </fieldset>
        </form>
      </div>
    </PageSurface>
  );
}
