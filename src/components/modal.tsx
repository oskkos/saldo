import { ReactNode } from 'react';

export function showModal(modalId: string) {
  (
    window[modalId as unknown as number] as unknown as { showModal(): void }
  ).showModal();
}

export function closeModal(modalId: string) {
  (
    window[modalId as unknown as number] as unknown as { close(): void }
  ).close();
}

export default function Modal({
  id,
  children,
  confirmLabel,
  confirmAction,
  confirmDisabled = false,
  secondaryLabel,
  secondaryAction,
  secondaryClassName = '',
}: {
  id: string;
  children: ReactNode;
  confirmLabel: string;
  confirmAction: () => void;
  confirmDisabled?: boolean;
  secondaryLabel?: string;
  secondaryAction?: () => void;
  secondaryClassName?: string;
}) {
  return (
    <dialog id={id} className="modal modal-bottom sm:modal-middle">
      <form method="dialog" className="modal-box text-base-content">
        {children}
        <div className="modal-action">
          <button className="btn">Cancel</button>
          {secondaryLabel && secondaryAction ? (
            // type=button so it does not submit/close the dialog (e.g. lets a
            // confirm prompt cancel without dismissing the modal).
            <button
              type="button"
              className={`btn ${secondaryClassName}`}
              onClick={secondaryAction}
            >
              {secondaryLabel}
            </button>
          ) : null}
          {/* type=button so the dialog is not dismissed the instant this is
              tapped. The action is asynchronous, and its outcome may be a
              question the user has to answer (an overlap confirmation) — a
              dialog that has already closed would take the user's input with
              it. Callers close explicitly once the action reports success.
              Same reasoning as the secondary button above. */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={confirmAction}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
