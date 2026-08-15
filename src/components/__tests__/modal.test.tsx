import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Modal, { closeModal, showModal } from '../modal';

// Role queries pass `hidden: true` throughout: a <dialog> that has not been opened
// is hidden, so its contents are outside the accessibility tree. These tests are
// about the markup the modal builds, not about whether it is currently on screen.
//
// The button types are the reason this has its own test. Both the confirm and the
// secondary button are deliberately type="button" so that pressing them does not
// submit the dialog's form and dismiss the modal — the confirm action is
// asynchronous and its outcome may be a question the user has to answer, which a
// dialog that closed on the tap could not host. Callers close explicitly on
// success. Nothing about that is visible, so a refactor could drop the attribute
// and only a test would notice.
//
// Cancel keeps its default submit behaviour: dismissing is all it does.

describe('Modal', () => {
  const renderModal = (props: Partial<Parameters<typeof Modal>[0]> = {}) =>
    render(
      <Modal
        id="a-modal"
        confirmLabel="Save"
        confirmAction={props.confirmAction ?? jest.fn()}
        {...props}
      >
        <p>body</p>
      </Modal>,
    );

  it('confirms through the given action', async () => {
    const confirmAction = jest.fn();
    renderModal({ confirmAction });

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Save', hidden: true }));

    expect(confirmAction).toHaveBeenCalled();
  });

  it('confirms without dismissing the dialog itself', async () => {
    const confirmAction = jest.fn();
    renderModal({ confirmAction });

    const confirm = screen.getByRole('button', { name: 'Save', hidden: true });
    // A submit button here would close the dialog through method="dialog",
    // taking the user's input with it before the action had answered.
    expect(confirm).toHaveAttribute('type', 'button');

    await userEvent.setup().click(confirm);
    expect(confirmAction).toHaveBeenCalled();
  });

  it('leaves Cancel as the one button that just dismisses', () => {
    renderModal();

    // No explicit type: it submits form method="dialog", which closes the modal
    // and runs nothing.
    expect(
      screen.getByRole('button', { name: 'Cancel', hidden: true }),
    ).not.toHaveAttribute('type', 'button');
  });

  it('refuses to confirm while the caller says the contents are invalid', () => {
    renderModal({ confirmDisabled: true });

    expect(
      screen.getByRole('button', { name: 'Save', hidden: true }),
    ).toBeDisabled();
  });

  it('offers a secondary action that does not dismiss the dialog', async () => {
    const secondaryAction = jest.fn();
    renderModal({ secondaryLabel: 'Discard', secondaryAction });

    const secondary = screen.getByRole('button', {
      name: 'Discard',
      hidden: true,
    });
    // A submit button here would close the dialog through method="dialog".
    expect(secondary).toHaveAttribute('type', 'button');

    await userEvent.setup().click(secondary);
    expect(secondaryAction).toHaveBeenCalled();
  });

  it('omits the secondary button unless both a label and an action are given', () => {
    const { unmount } = renderModal({ secondaryLabel: 'Discard' });
    expect(
      screen.queryByRole('button', { name: 'Discard', hidden: true }),
    ).not.toBeInTheDocument();
    unmount();

    renderModal({ secondaryAction: jest.fn() });
    expect(screen.getAllByRole('button', { hidden: true })).toHaveLength(2); // Cancel + Save only
  });
});

describe('showModal / closeModal', () => {
  const stubbedIds: string[] = [];

  // The helpers reach the dialog through the id-keyed global that browsers expose
  // for elements, so a stub standing in for the element is what can be observed.
  const stubDialog = (id: string) => {
    const dialog = { showModal: jest.fn(), close: jest.fn() };
    Object.assign(window, { [id]: dialog });
    stubbedIds.push(id);
    return dialog;
  };

  // Taken back off the global afterwards: these names would otherwise stay set for
  // the rest of the file.
  afterEach(() => {
    for (const id of stubbedIds.splice(0)) {
      delete (window as unknown as Record<string, unknown>)[id];
    }
  });

  it('opens the dialog named by id', () => {
    const dialog = stubDialog('open-me');

    showModal('open-me');

    expect(dialog.showModal).toHaveBeenCalled();
  });

  it('closes the dialog named by id', () => {
    const dialog = stubDialog('close-me');

    closeModal('close-me');

    expect(dialog.close).toHaveBeenCalled();
  });
});
