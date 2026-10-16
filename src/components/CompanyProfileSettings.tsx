import React, { useEffect, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from '../lib/notify';

const FIELDS = [
  { key: 'companyName', label: 'Company name', placeholder: 'AJ Network Solutions', hint: 'Shown on the PDF footer and the client approval page.' },
  { key: 'companyPhone', label: 'Phone', placeholder: '+966 920002087', hint: 'Printed in the PDF footer.' },
  { key: 'companyEmail', label: 'Email', placeholder: 'info@ajnetworksa.com', hint: 'Printed in the PDF footer.' },
] as const;

/** Company contact details used by the PDF footer and the client approval page (previously hard-coded). */
export default function CompanyProfileSettings() {
  const [values, setValues] = useState<Record<string, string>>({ companyName: '', companyPhone: '', companyEmail: '' });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(FIELDS.map(f => fetch(`/api/settings/${f.key}`).then(r => (r.ok ? r.json() : { value: '' })).catch(() => ({ value: '' }))))
      .then(results => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        FIELDS.forEach((f, i) => { next[f.key] = results[i].value || ''; });
        setValues(next);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.companyEmail)) { toast('Please enter a valid email address.', 'warning'); return; }
    setSaving(true);
    try {
      const results = await Promise.all(FIELDS.map(f => fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: f.key, value: values[f.key].trim() }),
      })));
      if (results.every(r => r.ok)) toast('Company details saved.', 'success');
      else toast('Could not save the company details.', 'error');
    } catch { toast('Network error: could not save.', 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700"><Building2 size={18} /></div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Company Details</h2>
          <p className="text-sm text-gray-500 mt-0.5">Contact details for the PDF footer and the client approval page. Leave blank to use the defaults.</p>
        </div>
      </div>
      <form onSubmit={save} className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {FIELDS.map(f => (
          <div key={f.key}>
            <label htmlFor={`co-${f.key}`} className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
            <input id={`co-${f.key}`} value={values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} maxLength={120} disabled={!loaded}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">{f.hint}</p>
          </div>
        ))}
        <div className="md:col-span-3">
          <button type="submit" disabled={saving || !loaded} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="animate-spin" size={16} />} Save details
          </button>
        </div>
      </form>
    </div>
  );
}
