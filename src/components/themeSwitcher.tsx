'use client';

import React, { useEffect, useState } from 'react';
import { MdOutlineLightMode } from 'react-icons/md';
import { MdOutlineDarkMode } from 'react-icons/md';

const getPrefersDarkMode = () =>
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const getDarkModeSetting = () => {
  const fromLocalStorage = localStorage.getItem('darkMode');
  if (fromLocalStorage) {
    return fromLocalStorage;
  }
  return getPrefersDarkMode();
};
export default function ThemeSwitcher({ className }: { className: string }) {
  const [darkMode, setDarkMode] = useState(getDarkModeSetting());
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    console.log('darkMode', darkMode, localStorage.getItem('darkMode'));
  }, [darkMode]);

  return (
    <label title="Light/dark mode" className="swap swap-rotate">
      {/* this hidden checkbox controls the state */}
      <input
        type="checkbox"
        className="theme-controller"
        value={darkMode ? 'dark' : 'light'}
        onChange={() => setDarkMode(!darkMode)}
      />

      <MdOutlineLightMode className={`${className} swap-on`} />
      <MdOutlineDarkMode className={`${className} swap-off`} />
    </label>
  );
}
