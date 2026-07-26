import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { useContext } from 'react';

import ToastContextWrapper, { ToastContext } from '../toastContext';

// The wrapper both shows a toast and takes it away again after two seconds. The
// dismissal is the part nothing else covers: a toast that never cleared would sit
// over the page for the rest of the session.

const Trigger = () => {
  const { setMsg } = useContext(ToastContext);
  return (
    <button onClick={() => setMsg({ type: 'success', message: 'Saved' })}>
      announce
    </button>
  );
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ToastContextWrapper', () => {
  it('shows nothing until something asks it to', () => {
    render(
      <ToastContextWrapper>
        <Trigger />
      </ToastContextWrapper>,
    );

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'announce' }),
    ).toBeInTheDocument();
  });

  it('shows a message and clears it again', () => {
    render(
      <ToastContextWrapper>
        <Trigger />
      </ToastContextWrapper>,
    );

    act(() => {
      screen.getByRole('button', { name: 'announce' }).click();
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});
