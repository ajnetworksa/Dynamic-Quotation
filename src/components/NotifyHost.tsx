import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { subscribe, getToasts, getConfirms, dismissToast, resolveConfirm, ToastKind } from '../lib/notify';

const STYLES: Record<ToastKind, { box: string; icon: React.ReactNode }> = {
  success: { box: 'bg-emerald-50 border-emerald-300 text-emerald-900', icon: <CheckCircle2 size={18} className="text-emerald-600 shrink-0" aria-hidden="true" /> },
  error: { box: 'bg-red-50 border-red-300 text-red-900', icon: <AlertCircle size={18} className="text-red-600 shrink-0" aria-hidden="true" /> },
  warning: { box: 'bg-amber-50 border-amber-300 text-amber-900', icon: <AlertTriangle size={18} className="text-amber-600 shrink-0" aria-hidden="true" /> },
  info: { box: 'bg-white border-gray-300 text-gray-900', icon: <Info size={18} className="text-indigo-600 shrink-0" aria-hidden="true" /> },
};

function ConfirmDialog({ id, message, confirmLabel, cancelLabel, danger }: { id: number; message: string; confirmLabel: string; cancelLabel: string; danger: boolean }) {
  const okRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Destructive actions start focused on Cancel so Enter cannot delete by accident.
    (danger ? cancelRef : okRef).current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); resolveConfirm(id, false); }
      if (e.key === 'Tab') {
        const nodes = boxRef.current?.querySelectorAll<HTMLElement>('button');
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); opener?.focus?.(); };
  }, [id, danger]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) resolveConfirm(id, false); }}>
      <div ref={boxRef} role="alertdialog" aria-modal="true" aria-labelledby={`confirm-msg-${id}`} className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <p id={`confirm-msg-${id}`} className="text-gray-800 whitespace-pre-line mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button ref={cancelRef} onClick={() => resolveConfirm(id, false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
            {cancelLabel}
          </button>
          <button ref={okRef} onClick={() => resolveConfirm(id, true)} className={`px-4 py-2 rounded-lg text-white font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${danger ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600' : 'bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-indigo-600'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mount once near the app root. Renders toasts (aria-live) and confirm dialogs. */
export default function NotifyHost() {
  useDialogAccessibility();
  const toasts = useSyncExternalStore(subscribe, getToasts);
  const confirms = useSyncExternalStore(subscribe, getConfirms);
  const current = confirms[0];

  return (
    <>
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-[110] flex flex-col gap-2 sm:w-96 pointer-events-none print:hidden" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-2 border rounded-lg shadow-lg px-3 py-2 text-sm ${STYLES[t.kind].box}`}>
            {STYLES[t.kind].icon}
            <span className="flex-1 whitespace-pre-line break-words">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="p-0.5 rounded hover:bg-black/5">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {current && <ConfirmDialog key={current.id} {...current} />}
    </>
  );
}

/**
 * Generic modal accessibility for every [role="dialog"] in the app (profile, follow-up, timeline, product
 * forms ...): moves focus into the dialog when it opens, keeps Tab inside it, closes the top dialog on Escape
 * (by pressing its Close / Cancel button) and returns focus to the element that opened it.
 */
export function useDialogAccessibility() {
  useEffect(() => {
    const openers = new Map<Element, HTMLElement | null>();
    const focusables = (root: Element) =>
      Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
        .filter(el => el.offsetParent !== null);
    const topDialog = () => {
      const all = Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"]'));
      return all[all.length - 1] || null;
    };

    const scan = () => {
      const current = new Set(document.querySelectorAll('[role="dialog"],[role="alertdialog"]'));
      current.forEach(d => {
        if (!openers.has(d)) {
          openers.set(d, document.activeElement as HTMLElement | null);
          if (!d.contains(document.activeElement)) {
            const first = focusables(d)[0];
            (first || (d as HTMLElement)).focus?.();
          }
        }
      });
      openers.forEach((opener, d) => {
        if (!current.has(d)) {
          openers.delete(d);
          if (opener && document.contains(opener)) opener.focus?.();
        }
      });
    };

    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();

    const onKey = (e: KeyboardEvent) => {
      const dlg = topDialog();
      if (!dlg || dlg.getAttribute('role') === 'alertdialog') return; // confirm dialogs handle their own keys
      if (e.key === 'Escape') {
        const closer = Array.from(dlg.querySelectorAll<HTMLElement>('button')).find(b => /^(close|cancel|dismiss)/i.test((b.getAttribute('aria-label') || b.textContent || '').trim()));
        if (closer) { e.preventDefault(); closer.click(); }
      } else if (e.key === 'Tab') {
        const nodes = focusables(dlg);
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { observer.disconnect(); document.removeEventListener('keydown', onKey); };
  }, []);
}
