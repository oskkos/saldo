import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ThemeSwitcher from '../themeSwitcher';

// The chosen theme is remembered in localStorage, so what matters is that the switch
// reflects what is stored, that a stored choice beats the system preference, and that
// switching writes the opposite back.
//
// matchMedia is set per test rather than left to the environment: jsdom happens not to
// define it, so relying on that would mean a jsdom upgrade or a polyfill in
// jest.setup.js could silently flip which branch these tests exercise while they
// carried on passing.

/** Stand in for the media query, or take it away to exercise the guard. */
const setPrefersDark = (prefersDark: boolean | 'unsupported') => {
  if (prefersDark === 'unsupported') {
    delete (window as unknown as Record<string, unknown>).matchMedia;
    return;
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn(() => ({ matches: prefersDark })),
  });
};

beforeEach(() => {
  localStorage.clear();
  setPrefersDark(false);
});

afterEach(() => {
  setPrefersDark('unsupported');
});

const toggle = () => screen.getByRole('checkbox');

describe('ThemeSwitcher', () => {
  it('starts from the system preference when nothing is stored', () => {
    render(<ThemeSwitcher className="icon" />);

    expect(screen.getByTitle('Light/dark mode')).toBeInTheDocument();
    expect(toggle()).not.toBeChecked();
  });

  it('follows a dark system preference when nothing is stored', () => {
    setPrefersDark(true);

    render(<ThemeSwitcher className="icon" />);

    expect(toggle()).toBeChecked();
  });

  it('works where the media query is unavailable', () => {
    setPrefersDark('unsupported');

    render(<ThemeSwitcher className="icon" />);

    // The guard treats an absent matchMedia as "no dark preference" rather than
    // throwing on every render.
    expect(toggle()).not.toBeChecked();
  });

  it('reflects a stored preference', () => {
    localStorage.setItem('saldoAlternateTheme', 'true');

    render(<ThemeSwitcher className="icon" />);

    expect(toggle()).toBeChecked();
  });

  it('lets a stored choice override the system preference', () => {
    setPrefersDark(true);
    localStorage.setItem('saldoAlternateTheme', 'false');

    render(<ThemeSwitcher className="icon" />);

    expect(toggle()).not.toBeChecked();
  });

  it('remembers the choice when switched', async () => {
    render(<ThemeSwitcher className="icon" />);

    await userEvent.setup().click(toggle());

    expect(localStorage.getItem('saldoAlternateTheme')).toBe('true');
    expect(toggle()).toBeChecked();
  });

  it('switches back again', async () => {
    localStorage.setItem('saldoAlternateTheme', 'true');
    render(<ThemeSwitcher className="icon" />);

    await userEvent.setup().click(toggle());

    expect(localStorage.getItem('saldoAlternateTheme')).toBe('false');
    expect(toggle()).not.toBeChecked();
  });
});
