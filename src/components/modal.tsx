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
}: {
  id: string;
  children: ReactNode;
  confirmLabel: string;
  confirmAction: () => void;
}) {
  return (
    <dialog id={id} className="modal modal-bottom sm:modal-middle">
      <form method="dialog" className="modal-box">
        {children}
        <div className="modal-action">
          <button className="btn">Cancel</button>
          <button className="btn btn-primary" onClick={confirmAction}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
