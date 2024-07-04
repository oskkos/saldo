'use client';

import { DARK_THEME, LIGHT_THEME } from '@/constants';
import React, { useState } from 'react';
import { MdOutlineLightMode } from 'react-icons/md';
import { MdOutlineDarkMode } from 'react-icons/md';

const getPrefersDarkMode = () =>
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const ALTERNATE_THEME = getPrefersDarkMode() ? LIGHT_THEME : DARK_THEME;

const alternateThemeInUse = () => {
  const fromLocalStorage = localStorage.getItem('saldoAlternateTheme');
  if (fromLocalStorage) {
    return JSON.parse(fromLocalStorage) as boolean;
  }
  return getPrefersDarkMode();
};
export default function ThemeSwitcher({ className }: { className: string }) {
  const initTheme = alternateThemeInUse();
  const [alternateTheme, setAlternateTheme] = useState(initTheme);

  return (
    <label title="Light/dark mode" className="swap swap-rotate">
      {/* this hidden checkbox controls the state */}
      <input
        type="checkbox"
        className="theme-controller"
        checked={initTheme}
        value={ALTERNATE_THEME}
        onChange={() => {
          localStorage.setItem(
            'saldoAlternateTheme',
            JSON.stringify(!alternateTheme),
          );
          setAlternateTheme(!alternateTheme);
        }}
      />
      {ALTERNATE_THEME === LIGHT_THEME ? (
        <>
          <MdOutlineLightMode className={`${className} swap-on`} />
          <MdOutlineDarkMode className={`${className} swap-off`} />
        </>
      ) : (
        <>
          <MdOutlineLightMode className={`${className} swap-off`} />
          <MdOutlineDarkMode className={`${className} swap-on`} />
        </>
      )}
    </label>
  );
}
