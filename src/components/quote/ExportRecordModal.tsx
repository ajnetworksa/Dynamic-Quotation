import React from 'react';
import { Save } from 'lucide-react';

interface Props {
  onRecordAndExport: () => void;
  onExportWithoutRecording: () => void;
  onCancel: () => void;
}

/** Shown when exporting a quotation that has not been recorded yet. */
export default function ExportRecordModal({ onRecordAndExport, onExportWithoutRecording, onCancel }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Record quotation before export" className="fixed inset-0 z-[10000] flex items-center justify-center p-4 print:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0"><Save size={24} /></div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Record Quotation?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              This quotation has not been recorded to the system yet. Would you like to assign a Quote ID and record it before exporting?
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 mt-6">
          <button type="button" onClick={onRecordAndExport} className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
            <Save size={16} /> Record & Export
          </button>
          <button type="button" onClick={onExportWithoutRecording} className="w-full py-2.5 px-4 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold rounded-xl text-sm transition-colors">
            Export Without Recording
          </button>
          <button type="button" onClick={onCancel} className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
