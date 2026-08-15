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

import type { Worklog } from '@/types';

// Editing is the one write that can silently corrupt existing data, so what is
// asserted is that the row's own id goes with the change, and that a refusal is
// reported rather than swallowed — the browser suite only ever edits successfully.
jest.mock('@/actions', () => ({ onWorklogEdit: jest.fn() }));

type EditMock = jest.Mock<
  (
    id: number,
    data: unknown,
    options?: { allowOverlap?: boolean },
  ) => Promise<unknown>
>;

let WorklogEditModal: typeof import('../worklogEditModal').default;
let ToastContext: typeof import('../../toastContext').ToastContext;
let edit: EditMock;

beforeAll(async () => {
  WorklogEditModal = (await import('../worklogEditModal')).default;
  ToastContext = (await import('../../toastContext')).ToastContext;
  edit = (await import('@/actions')).onWorklogEdit as unknown as EditMock;
});

const worklog: Worklog = {
  id: 42,
  from: new Date('2026-07-26T08:00:00Z'),
  to: new Date('2026-07-26T16:00:00Z'),
  subtractLunchBreak: true,
  absence: null,
  comment: 'worked late',
};

const onEdit = jest.fn();
const setMsg = jest.fn<(msg: unknown) => void>();

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
  edit.mockReset();
  onEdit.mockReset();
  setMsg.mockReset();
  render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <WorklogEditModal
        worklog={worklog}
        editModalId="edit-42"
        onEdit={onEdit}
      />
    </ToastContext.Provider>,
  );
  // Opened the way the worklog row opens it, so the close-on-success and
  // stay-open-on-refusal behaviour can be observed at all.
  dialog().showModal();
});

const confirm = async () =>
  userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Edit', hidden: true }));

describe('WorklogEditModal', () => {
  it('opens on the values the worklog already has', () => {
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('16:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('worked late')).toBeInTheDocument();
  });

  it('sends the change against the row it belongs to', async () => {
    edit.mockResolvedValue({ status: 'success', worklog: { id: 42 } });

    await confirm();

    // The id is what stops an edit landing on somebody else's worklog.
    await waitFor(() =>
      expect(edit).toHaveBeenCalledWith(42, expect.anything(), {
        allowOverlap: false,
      }),
    );
    const toast = shownToast();
    expect(toast.type).toBe('success');
    expect(toast.getByText('Worklog updated')).toBeInTheDocument();
    expect(dialog().open).toBe(false);
  });

  // @scenario worklog/A rejection is returned with a readable message
  it('reports the reason when the change is refused', async () => {
    edit.mockResolvedValue({
      status: 'error',
      message: 'End time must be after start time',
    });

    await confirm();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(toast.getByText('Failed to update worklog')).toBeInTheDocument();
    expect(
      toast.getByText('End time must be after start time'),
    ).toBeInTheDocument();
    // A refused edit leaves the form open with the user's values in it.
    expect(dialog().open).toBe(true);
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
  });

  // @scenario worklog/Editing an entry does not conflict with itself
  describe('when the edit overlaps another stored entry', () => {
    const conflict = {
      status: 'conflict',
      message: 'This overlaps 26.7.2026 13:00–16:00.',
      conflicts: [
        {
          from: new Date('2026-07-26T13:00:00Z'),
          to: new Date('2026-07-26T16:00:00Z'),
        },
      ],
    };

    // @scenario worklog/Declined overlap persists nothing
    it('keeps the modal open on the edited values when declined', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      edit.mockResolvedValue(conflict);

      await confirm();

      await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
      expect(edit).toHaveBeenCalledTimes(1);
      expect(onEdit).not.toHaveBeenCalled();
      expect(setMsg).not.toHaveBeenCalled();
      expect(dialog().open).toBe(true);
      confirmSpy.mockRestore();
    });

    // @scenario worklog/Confirmed overlap is persisted
    it('saves anyway when confirmed', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      edit
        .mockResolvedValueOnce(conflict)
        .mockResolvedValueOnce({ status: 'success', worklog: { id: 42 } });

      await confirm();

      await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
      expect(edit.mock.calls[1][2]).toEqual({ allowOverlap: true });
      await waitFor(() => expect(dialog().open).toBe(false));
      confirmSpy.mockRestore();
    });
  });

  it('still reports a genuine failure that was thrown', async () => {
    edit.mockRejectedValue(new Error('worklog belongs to someone else'));

    await confirm();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(
      toast.getByText('worklog belongs to someone else'),
    ).toBeInTheDocument();
  });
});
