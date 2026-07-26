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

import type { Date_Time } from '@/util/dateFormatter';

// QuickAdd's whole job is to open the modal, which it does through an effect rather
// than directly — so what is asserted is that showModal was reached, and that it can
// be reached again after a worklog is added. The modal itself is stubbed down to the
// callback it invokes; it has its own test.
jest.mock('../modal', () => ({ showModal: jest.fn() }));
jest.mock('../quickAddModal', () => ({
  __esModule: true,
  default: ({ onSubmit }: { onSubmit: () => void }) => (
    <button onClick={onSubmit}>stub-save</button>
  ),
}));

type ShowModalMock = jest.Mock<(id: string) => void>;

let QuickAdd: typeof import('../quickAdd').default;
let showModal: ShowModalMock;

beforeAll(async () => {
  QuickAdd = (await import('../quickAdd')).default;
  showModal = (await import('../modal')).showModal as unknown as ShowModalMock;
});

// Same cast helper the neighbouring worklogInputs test uses.
const time = (s: string) => s as Date_Time;
const fromDefault = time('08:00');
const toDefault = time('16:00');

let container: HTMLElement;

beforeEach(() => {
  showModal.mockReset();
  container = render(
    <QuickAdd defaults={{ fromDefault, toDefault }} />,
  ).container;
});

// The trigger is an icon with a click handler and no accessible role of its own.
const addIcon = () => container.querySelector('svg') as SVGElement;

describe('QuickAdd', () => {
  it('opens the quick-add modal when the icon is used', async () => {
    await userEvent.setup().click(addIcon());

    await waitFor(() =>
      expect(showModal).toHaveBeenCalledWith('worklog-new-worklog-modal'),
    );
  });

  it('can be opened again after a worklog is added', async () => {
    const user = userEvent.setup();
    await user.click(addIcon());
    await waitFor(() => expect(showModal).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'stub-save' }));
    await user.click(addIcon());

    await waitFor(() => expect(showModal).toHaveBeenCalledTimes(2));
  });
});
