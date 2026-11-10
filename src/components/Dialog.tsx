import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Dialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Capture before React mounts an auto-focused field inside the dialog.
  const [previouslyFocused] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => {
    const dialog = ref.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    (dialog.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled)') ?? dialog.querySelector<HTMLElement>('.dialog-actions button[type="button"]'))?.focus();
    return () => {
      dialog.close(); document.body.style.overflow = overflow;
      (previouslyFocused?.isConnected ? previouslyFocused : document.getElementById('main'))?.focus({ preventScroll: true });
    };
  }, [previouslyFocused]);
  return <dialog ref={ref} className="dialog" aria-labelledby={titleId} aria-busy={busy} onCancel={event => {
    event.preventDefault();
    if (!busy) onClose();
  }}>
    <div className="dialog-header"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Cerrar diálogo" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
