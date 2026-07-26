import { beforeEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ThemeSwitcher from '../themeSwitcher';

// The chosen theme is remembered in localStorage, so what matters is that the switch
// reflects what is stored and writes back the opposite. jsdom defines no matchMedia,
// which the component already guards against — that guard is the same path a browser
// without the media query takes.

beforeEach(() => {
  localStorage.clear();
});

const toggle = () => screen.getByRole('checkbox');

describe('ThemeSwitcher', () => {
  it('starts from the system preference when nothing is stored', () => {
    render(<ThemeSwitcher className="icon" />);

    expect(screen.getByTitle('Light/dark mode')).toBeInTheDocument();
    expect(toggle()).not.toBeChecked();
  });

  it('reflects a stored preference', () => {
    localStorage.setItem('saldoAlternateTheme', 'true');

    render(<ThemeSwitcher className="icon" />);

    expect(toggle()).toBeChecked();
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
