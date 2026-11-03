import React from 'react';

const OVERLAY = 'fixed inset-0 bg-black/50 z-[200] flex items-center justify-center print:hidden';
const BOX = 'bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4';

/** Shown when the chosen Quote ID already belongs to a recorded quote. */
export function OverwriteModal({ quoteId, onOverwrite, onNewId, onCancel }: { quoteId: string; onOverwrite: () => void; onNewId: () => void; onCancel: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Quote ID exists" className={OVERLAY}>
      <div className={BOX}>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Quote ID Exists</h3>
        <p className="text-gray-600 mb-6">A quote with ID <span className="font-bold">{quoteId}</span> already exists. How would you like to proceed?</p>
        <div className="flex flex-col gap-3">
          <button onClick={onOverwrite} className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">Overwrite Existing Quote ({quoteId})</button>
          <button onClick={onNewId} className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">Generate New ID &amp; Save</button>
          <button onClick={onCancel} className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** Shown when the server holds a newer version of the quote than the one being edited. */
export function ConflictModal({ onCancel, onReload, onSaveAsRevision, onForce }: { onCancel: () => void; onReload: () => void; onSaveAsRevision: () => void; onForce: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Version conflict" className={OVERLAY}>
      <div className={BOX}>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Version Conflict</h3>
        <p className="text-gray-600 mb-6">The server has a newer version of this quote. Another user may have modified it since you opened it.</p>
        <div className="flex flex-col gap-3">
          <button onClick={onCancel} className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors border border-gray-300">Cancel (Review my changes)</button>
          <button onClick={onReload} className="w-full py-2 px-4 bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium rounded-lg transition-colors">Reload from Server (Discard mine)</button>
          <button onClick={onSaveAsRevision} className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors">Save as New Revision</button>
          <button onClick={onForce} className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">Force Overwrite Server Version</button>
        </div>
      </div>
    </div>
  );
}

/** Name a reusable terms template. */
export function SaveTemplateModal({ name, setName, onSave, onCancel }: { name: string; setName: (v: string) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Save terms as template" className={OVERLAY}>
      <div className={BOX}>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Save Terms as Template</h3>
        <p className="text-gray-600 mb-4 text-sm">Save the current Note, Payment, Warranty, Duration, Mobilization, Manpower, Bank Details, and Footer as a reusable template.</p>
        <label htmlFor="tpl-name" className="sr-only">Template name</label>
        <input
          id="tpl-name"
          type="text"
          autoFocus
          placeholder="E.g., Standard CCTV Terms"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 mb-6 text-gray-900 bg-white"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSave()}
        />
        <div className="flex justify-end gap-3 font-medium">
          <button className="px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700" onClick={onCancel}>Cancel</button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors" onClick={onSave}>Save Template</button>
        </div>
      </div>
    </div>
  );
}
