import React, { useState } from 'react';
import { Lock, Download, Upload, Loader2 } from 'lucide-react';
import { toast, confirmAsync } from '../lib/notify';

/** Passphrase-protected backups (AES-256-GCM): safe to keep in cloud storage or e-mail. Download and restore. */
export default function EncryptedBackupPanel() {
  const [pass, setPass] = useState('');
  const [restorePass, setRestorePass] = useState('');
  const [busy, setBusy] = useState<'' | 'backup' | 'restore'>('');

  const download = async () => {
    if (pass.length < 12) { toast('The passphrase must be at least 12 characters. Keep it safe: without it the backup cannot be opened.', 'warning'); return; }
    setBusy('backup');
    try {
      const res = await fetch('/api/admin/backup-encrypted', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase: pass }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); toast(b.details?.join('; ') || b.error || 'Backup failed.', 'error'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `quotes-backup-${new Date().toISOString().slice(0, 10)}.db.enc`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('Encrypted backup downloaded.', 'success');
      setPass('');
    } catch { toast('Network error: backup failed.', 'error'); } finally { setBusy(''); }
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    if (restorePass.length < 12) { toast('Enter the backup passphrase first (at least 12 characters).', 'warning'); return; }
    if (!await confirmAsync('Restoring will REPLACE all current data with this backup. A safety copy of the current database is kept in the backups folder. Continue?', { danger: true, confirmLabel: 'Restore' })) return;
    setBusy('restore');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('passphrase', restorePass);
      const res = await fetch('/api/admin/restore-encrypted', { method: 'POST', body: form });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast(b.error || 'Restore failed.', 'error'); return; }
      toast('Backup restored. Reloading…', 'success');
      setTimeout(() => window.location.reload(), 1200);
    } catch { toast('Network error: restore failed.', 'error'); } finally { setBusy(''); }
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-purple-900 mt-8 mb-2 flex items-center gap-2"><Lock size={18} /> Encrypted Backup (recommended for off-site copies)</h3>
      <p className="text-gray-600 mb-4 text-sm">
        A single `.db.enc` file protected with a passphrase (AES-256). Store it anywhere, for example cloud storage or a USB drive. <strong>If you lose the passphrase the backup cannot be opened.</strong>
      </p>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label htmlFor="enc-pass" className="block text-xs font-medium text-gray-600 mb-1">Passphrase (12+ characters)</label>
          <input id="enc-pass" type="password" autoComplete="new-password" value={pass} onChange={e => setPass(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-64" />
        </div>
        <button onClick={download} disabled={busy !== ''} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60">
          {busy === 'backup' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Download encrypted backup
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="enc-restore-pass" className="block text-xs font-medium text-gray-600 mb-1">Passphrase of the backup to restore</label>
          <input id="enc-restore-pass" type="password" autoComplete="off" value={restorePass} onChange={e => setRestorePass(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-64" />
        </div>
        <label className={`flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
          {busy === 'restore' ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} Restore from .db.enc
          <input type="file" accept=".enc" className="sr-only" onChange={e => { restore(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
    </div>
  );
}
