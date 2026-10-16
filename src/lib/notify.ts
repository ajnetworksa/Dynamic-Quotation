// Non-blocking replacements for window.alert / window.confirm.
//  - toast(message, kind?)      shows a message that fades out (screen-reader friendly, never blocks the page)
//  - confirmAsync(message, opts) shows a modal dialog and resolves true/false
// The UI for both is rendered by <NotifyHost /> (src/components/NotifyHost.tsx), mounted once in main.tsx.

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem { id: number; message: string; kind: ToastKind }
export interface ConfirmRequest {
  id: number;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

type Listener = () => void;
let nextId = 1;
let toasts: ToastItem[] = [];
let confirms: ConfirmRequest[] = [];
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(l => l());

export const subscribe = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getToasts = () => toasts;
export const getConfirms = () => confirms;

/** Pick a sensible style from the wording of legacy alert() messages. */
export function inferKind(message: string): ToastKind {
  const m = message.toLowerCase();
  if (/(fail|error|cannot|can't|denied|invalid|unable|could not|not allowed|forbidden|expired)/.test(m)) return 'error';
  if (/(success|saved|recorded|updated|complete|deleted|restored|copied|sent|created|imported|exported)/.test(m)) return 'success';
  if (/(please|required|missing|select|enter|must|zero|no records|nothing)/.test(m)) return 'warning';
  return 'info';
}

export function dismissToast(id: number) {
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

export function toast(message: unknown, kind?: ToastKind) {
  const text = String(message ?? '').trim();
  if (!text) return;
  const item: ToastItem = { id: nextId++, message: text, kind: kind || inferKind(text) };
  toasts = [...toasts.slice(-4), item]; // keep at most 5 on screen
  emit();
  const ms = item.kind === 'error' ? 8000 : 4500;
  setTimeout(() => dismissToast(item.id), ms);
}

export interface ConfirmOptions { confirmLabel?: string; cancelLabel?: string; danger?: boolean }

export function confirmAsync(message: unknown, opts: ConfirmOptions = {}): Promise<boolean> {
  const text = String(message ?? '');
  // Words that signal a destructive action get the red button automatically.
  const danger = opts.danger ?? /(delete|remove|permanent|overwrite|cannot be undone|clear all|critical|restore|discard)/i.test(text);
  return new Promise<boolean>(resolve => {
    confirms = [...confirms, {
      id: nextId++,
      message: text,
      confirmLabel: opts.confirmLabel || (danger ? 'Yes, continue' : 'OK'),
      cancelLabel: opts.cancelLabel || 'Cancel',
      danger,
      resolve,
    }];
    emit();
  });
}

export function resolveConfirm(id: number, ok: boolean) {
  const req = confirms.find(c => c.id === id);
  if (!req) return;
  confirms = confirms.filter(c => c.id !== id);
  emit();
  req.resolve(ok);
}
