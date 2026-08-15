import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import type { Date_Time } from '@/util/dateFormatter';

// Saving is the only thing this modal does, and the browser suite only ever saves
// successfully — so the toast a user gets when the write is refused has never run.
// The real Modal and inputs are kept so the save button is reached the way a user
// reaches it.
jest.mock('@/actions', () => ({ onWorklogSubmit: jest.fn() }));

type SubmitMock = jest.Mock<(data: unknown) => Promise<unknown>>;

let QuickAddWorklogModal: typeof import('../quickAddModal').default;
let ToastContext: typeof import('../toastContext').ToastContext;
let submit: SubmitMock;

beforeAll(async () => {
  QuickAddWorklogModal = (await import('../quickAddModal')).default;
  ToastContext = (await import('../toastContext')).ToastContext;
  submit = (await import('@/actions')).onWorklogSubmit as unknown as SubmitMock;
});

const time = (s: string) => s as Date_Time;
const onSubmit = jest.fn();
const setMsg = jest.fn<(msg: unknown) => void>();

/** The toast the modal asked for, rendered so its text can be read. */
/**
 * The toast the component asked for, rendered on its own so its text can be read.
 *
 * The returned queries are bound to that render, not to the document — asserting
 * through `screen` here would also search the component's own tree, so a message that
 * happened to appear in both would pass for the wrong reason.
 */
const shownToast = () => {
  const [msg] = setMsg.mock.calls[0] as [{ type: string; message: ReactNode }];
  const { getByText } = render(<>{msg.message}</>);
  return { type: msg.type, getByText };
};

/** The modal's own <dialog>, so its open state can be asserted. */
const dialog = () => document.querySelector('dialog') as HTMLDialogElement;

beforeEach(() => {
  submit.mockReset();
  onSubmit.mockReset();
  setMsg.mockReset();
  render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <QuickAddWorklogModal
        modalId="quick-add"
        defaults={{ fromDefault: time('08:00'), toDefault: time('16:00') }}
        onSubmit={onSubmit}
      />
    </ToastContext.Provider>,
  );
  // Opened the way ClockCard/QuickAdd open it, so the close-on-success and
  // stay-open-on-refusal behaviour can be observed at all.
  dialog().showModal();
});

const save = async () =>
  userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Save', hidden: true }));

describe('QuickAddWorklogModal', () => {
  it('offers the defaults it was given', () => {
    expect(screen.getByText('Add new worklog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16:00')).toBeInTheDocument();
  });

  it('saves the worklog and says so', async () => {
    submit.mockResolvedValue({ status: 'success', worklog: { id: 1 } });

    await save();

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(setMsg).toHaveBeenCalled();
    const toast = shownToast();
    expect(toast.type).toBe('success');
    expect(toast.getByText('Worklog created')).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledWith({ id: 1 });
    expect(dialog().open).toBe(false);
  });

  // @scenario worklog/A rejection is returned with a readable message
  it('reports the reason when the save is refused', async () => {
    // The refusal arrives as a value, which is the only form whose message
    // survives a production build.
    submit.mockResolvedValue({
      status: 'error',
      message: 'End time must be after start time',
    });

    await save();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(toast.getByText('Failed to create worklog')).toBeInTheDocument();
    expect(
      toast.getByText('End time must be after start time'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    // The dialog no longer dismisses itself on tap, so a refusal leaves the
    // form open with the user's input still in it.
    expect(dialog().open).toBe(true);
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
  });

  it('still reports a genuine failure that was thrown', async () => {
    submit.mockRejectedValue(new Error('connection lost'));

    await save();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(toast.getByText('connection lost')).toBeInTheDocument();
  });
});
