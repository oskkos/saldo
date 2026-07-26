import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import Dock from '../dock';
import Menu from '../menu';
import { NavBarItemArray } from '../navItems';

// Dock and Menu are the same list rendered for two breakpoints, so they are tested
// together against the shared source of truth. What matters is that every route is
// reachable and that the current one is marked — a wrong href here strands a user on
// a page with no way back, and nothing else in the suite checks the marking.
jest.mock('next/navigation');

const pathname = usePathname as unknown as jest.Mock<() => string>;

beforeEach(() => {
  pathname.mockReturnValue('/');
});

describe('NavBarItemArray', () => {
  it('lists every destination exactly once', () => {
    const hrefs = NavBarItemArray.map(([href]) => href);

    expect(hrefs).toEqual([
      '/',
      '/worklog-items',
      '/absence',
      '/settings',
      '/statistics',
    ]);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe.each([
  ['Dock', Dock, 'dock-active'],
  ['Menu', Menu, 'border-b-2'],
] as const)('%s', (_name, Component, activeClass) => {
  it('links to every destination', () => {
    render(<Component />);

    for (const [href, , label] of NavBarItemArray) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      );
    }
  });

  it('marks the route currently being viewed', () => {
    pathname.mockReturnValue('/settings');
    const { container } = render(<Component />);

    const active = container.querySelectorAll(`.${activeClass}`);
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent('Settings');
  });

  it('marks nothing when the route is not one of them', () => {
    pathname.mockReturnValue('/somewhere-else');
    const { container } = render(<Component />);

    expect(container.querySelectorAll(`.${activeClass}`)).toHaveLength(0);
  });
});
