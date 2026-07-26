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

// The failure branch here is the reason this test exists: the browser suite deletes
// worklogs successfully and never makes the action reject, so the error toast — the
// only thing telling a user their delete did not happen — has never run.
//
// The real ToastContext provider is used rather than a mocked useContext, so what is
// asserted is the message a user would actually see.
jest.mock('@/actions', () => ({ onWorklogDelete: jest.fn() }));

type DeleteMock = jest.Mock<(id: number) => Promise<unknown>>;

let WorklogDeleteConfirm: typeof import('../worklogDeleteConfirm').default;
let ToastContext: typeof import('../../toastContext').ToastContext;
let remove: DeleteMock;

beforeAll(async () => {
  WorklogDeleteConfirm = (await import('../worklogDeleteConfirm')).default;
  ToastContext = (await import('../../toastContext')).ToastContext;
  remove = (await import('@/actions')).onWorklogDelete as unknown as DeleteMock;
});

const onDelete = jest.fn<(id: number) => void>();
const setMsg = jest.fn<(msg: unknown) => void>();

/** The toast the component asked for, rendered so its text can be read. */
const shownToast = () => {
  const [msg] = setMsg.mock.calls[0] as [{ type: string; message: ReactNode }];
  return { type: msg.type, ...render(<>{msg.message}</>) };
};

beforeEach(() => {
  remove.mockReset();
  onDelete.mockReset();
  setMsg.mockReset();
  render(
    <ToastContext.Provider value={{ msg: null, setMsg }}>
      <WorklogDeleteConfirm
        worklogId={7}
        confirmId="confirm-7"
        onDelete={onDelete}
      />
    </ToastContext.Provider>,
  );
});

const confirmDelete = async () =>
  userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Delete', hidden: true }));

describe('WorklogDeleteConfirm', () => {
  it('asks before deleting anything', () => {
    expect(
      screen.getByText('Are you sure you want to delete this worklog?'),
    ).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes the worklog and says so', async () => {
    remove.mockResolvedValue(undefined);

    await confirmDelete();

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(7));
    expect(remove).toHaveBeenCalledWith(7);
    const toast = shownToast();
    expect(toast.type).toBe('success');
    expect(screen.getByText('Worklog deleted')).toBeInTheDocument();
  });

  it('reports the reason when the delete is refused', async () => {
    remove.mockRejectedValue(new Error('worklog belongs to someone else'));

    await confirmDelete();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(screen.getByText('Failed to delete worklog')).toBeInTheDocument();
    expect(
      screen.getByText('worklog belongs to someone else'),
    ).toBeInTheDocument();
    // The row must stay on screen when the delete did not happen.
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('omits a reason when the failure carries none', async () => {
    remove.mockRejectedValue('a bare string');

    await confirmDelete();

    await waitFor(() => expect(setMsg).toHaveBeenCalled());
    const toast = shownToast();
    expect(toast.type).toBe('error');
    expect(screen.getByText('Failed to delete worklog')).toBeInTheDocument();
  });
});
