import { useEffect, useRef, useState } from 'react';
import { THEMES } from '../constants.js';

export function ThemePicker({ theme, onChangeTheme }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const current = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="icon-btn"
        aria-label="Choose theme"
        title={`Theme: ${current.name}`}
      >
        <i className={`bi ${current.icon}`} />
      </button>

      {open && (
        <div className="theme-menu absolute right-0 mt-2 z-50">
          <div className="theme-menu-title">Appearance</div>
          {THEMES.map((item) => {
            const active = item.id === current.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChangeTheme(item.id);
                  setOpen(false);
                }}
                className={`theme-option ${active ? 'active' : ''}`}
                aria-pressed={active}
              >
                <span className={`theme-swatch ${item.swatch}`} />
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-semibold">{item.name}</span>
                  <span className="text-[11px] cs-muted">{item.note}</span>
                </span>
                {active && <i className="bi bi-check2 ml-auto cs-brand text-base" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
