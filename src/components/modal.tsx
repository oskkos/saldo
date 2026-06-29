import { ReactNode } from 'react';

export function showModal(modalId: string) {
  (
    window[modalId as unknown as number] as unknown as { showModal(): void }
  ).showModal();
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
          <button
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
