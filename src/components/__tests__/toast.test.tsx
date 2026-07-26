import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import Toast from '../toast';

// Every toast in the app goes through here, and the type is the only signal of
// whether something went well or badly — worth pinning the whole map rather than the
// one variant a happy-path run produces.

describe('Toast', () => {
  it.each([
    ['info', 'alert-info'],
    ['success', 'alert-success'],
    ['warning', 'alert-warning'],
    ['error', 'alert-error'],
  ] as const)('styles a %s toast', (type, expected) => {
    const { container } = render(
      <Toast type={type} msg="something happened" />,
    );

    expect(screen.getByText('something happened')).toBeInTheDocument();
    expect(container.querySelector('.alert')).toHaveClass(expected);
  });

  it('carries no type styling when none is given', () => {
    const { container } = render(<Toast msg="plain" />);

    const alert = container.querySelector('.alert');
    expect(alert?.className.trim()).toBe('alert');
  });
});
