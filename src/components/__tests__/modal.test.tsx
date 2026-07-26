import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Modal, { closeModal, showModal } from '../modal';

// Role queries pass `hidden: true` throughout: a <dialog> that has not been opened
// is hidden, so its contents are outside the accessibility tree. These tests are
// about the markup the modal builds, not about whether it is currently on screen.
//
// The secondary button is the reason this has its own test. It is deliberately
// type="button" so that pressing it does not submit the dialog's form and dismiss
// the modal — a confirm prompt inside a modal has to be able to say no without the
// whole thing closing. Nothing about that is visible, so a refactor could drop the
// attribute and only a test would notice.

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
    // jsdom logs "Not implemented: HTMLFormElement.prototype.requestSubmit" here.
    // That is the point rather than a problem: the confirm button is a submit button
    // inside form method="dialog", so in a browser it both runs the action and
    // closes the modal — which is exactly what the secondary button must not do.
    const confirmAction = jest.fn();
    renderModal({ confirmAction });

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Save', hidden: true }));

    expect(confirmAction).toHaveBeenCalled();
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
