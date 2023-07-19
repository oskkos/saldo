export function showModal(modalId: string) {
  (
    window[modalId as unknown as number] as unknown as { showModal(): void }
  ).showModal();
}
