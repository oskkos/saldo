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

type EditMock = jest.Mock<(id: number, data: unknown) => Promise<unknown>>;

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
    edit.mockResolvedValue(undefined);

    await confirm();

    // The id is what stops an edit landing on somebody else's worklog.
    await waitFor(() =>
      expect(edit).toHaveBeenCalledWith(42, expect.anything()),
    );
    const toast = shownToast();
    expect(toast.type).toBe('success');
    expect(toast.getByText('Worklog updated')).toBeInTheDocument();
  });

  it('reports the reason when the change is refused', async () => {
    edit.mockRejectedValue(new Error('worklog belongs to someone else'));

    await confirm();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(toast.getByText('Failed to update worklog')).toBeInTheDocument();
    expect(
      toast.getByText('worklog belongs to someone else'),
    ).toBeInTheDocument();
  });
});
