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

import { AbsenceReason, type Worklog } from '@/types';

// The row's own logic is which controls it offers and which dialog it opens. An
// absence has no hours to edit, so offering an edit button for one would open a form
// over data it cannot represent — that omission is the assertion worth having.
//
// Both dialogs are stubbed; each has its own test. showModal is mocked because jsdom
// implements no dialog.
jest.mock('../../modal', () => ({ showModal: jest.fn() }));
jest.mock('../worklogDeleteConfirm', () => ({
  __esModule: true,
  default: () => <div>delete-confirm</div>,
}));
jest.mock('../worklogEditModal', () => ({
  __esModule: true,
  default: () => <div>edit-modal</div>,
}));

type ShowModalMock = jest.Mock<(id: string) => void>;

let WorklogItem: typeof import('../worklogItem').default;
let showModal: ShowModalMock;

beforeAll(async () => {
  WorklogItem = (await import('../worklogItem')).default;
  showModal = (await import('../../modal'))
    .showModal as unknown as ShowModalMock;
});

const worklog = (overrides: Partial<Worklog> = {}): Worklog => ({
  id: 42,
  from: new Date('2026-07-26T08:00:00Z'),
  to: new Date('2026-07-26T16:00:00Z'),
  subtractLunchBreak: false,
  absence: null,
  comment: null,
  ...overrides,
});

const renderItem = (overrides: Partial<Worklog> = {}, ignored?: boolean) =>
  render(
    <WorklogItem
      worklog={worklog(overrides)}
      onDelete={jest.fn()}
      onEdit={jest.fn()}
      ignored={ignored}
    />,
  );

beforeEach(() => {
  showModal.mockReset();
});

describe('WorklogItem', () => {
  it('offers edit and delete for a worked entry', () => {
    renderItem();

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('offers no edit for an absence, which has no hours to change', () => {
    renderItem({ absence: AbsenceReason.holiday });

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows a comment when there is one', () => {
    const { unmount } = renderItem();
    expect(screen.queryByText('worked late')).not.toBeInTheDocument();
    unmount();

    renderItem({ comment: 'worked late' });
    expect(screen.getByText('worked late')).toBeInTheDocument();
  });

  it('opens the delete confirmation for its own row', async () => {
    renderItem();

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Delete' }));

    // The id carries the worklog id, so one row's dialog cannot delete another's.
    await waitFor(() =>
      expect(showModal).toHaveBeenCalledWith('worklog-delete-confirm-42'),
    );
  });

  it('opens the edit dialog for its own row', async () => {
    renderItem();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() =>
      expect(showModal).toHaveBeenCalledWith('worklog-edit-modal-42'),
    );
  });

  it('dims a row that does not count towards the balance', () => {
    const { container } = renderItem({}, true);

    expect(container.querySelector('.bg-base-100')).not.toBeNull();
  });
});
