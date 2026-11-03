import React from 'react';
import { Building2, FileText, SlidersHorizontal, Mail, Database, Server, LayoutGrid } from 'lucide-react';

export type SettingsSectionId = 'company' | 'documents' | 'quotes' | 'email' | 'data' | 'system' | 'all';

export const SETTINGS_SECTIONS: { id: SettingsSectionId; label: string; description: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'company', label: 'Company & Branding', description: 'Company details, logo, footer image, stamp and theme colours.', icon: Building2 },
  { id: 'documents', label: 'Documents & PDF', description: 'Font sizes, default terms, PDF engine, quote numbering and markup filters.', icon: FileText },
  { id: 'quotes', label: 'Quote Behaviour', description: 'Row reordering, translation, discount mode and workflow visibility.', icon: SlidersHorizontal },
  { id: 'email', label: 'Email', description: 'SMTP server used to send quotations.', icon: Mail },
  { id: 'data', label: 'Data & Backups', description: 'Export, import, backups, restore and the Recycle Bin.', icon: Database },
  { id: 'system', label: 'System', description: 'Logs, developer mode and updates.', icon: Server },
  { id: 'all', label: 'Show everything', description: 'Every setting on one page.', icon: LayoutGrid },
];

export function parseSettingsSection(hash: string): SettingsSectionId {
  const id = hash.replace(/^#/, '');
  return (SETTINGS_SECTIONS.find(s => s.id === id)?.id) ?? 'company';
}

export function SettingsNav({ active, onSelect }: { active: SettingsSectionId; onSelect: (id: SettingsSectionId) => void }) {
  return (
    <nav aria-label="Settings sections" className="mb-4 md:mb-0 md:w-60 md:shrink-0 md:sticky md:top-4">
      <div className="hidden md:block px-3 pb-3">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-xs text-gray-500 mt-1">Pick a section to see its settings.</p>
      </div>
      <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible bg-white md:bg-transparent rounded-xl border border-gray-200 md:border-0 p-1 md:p-0">
        {SETTINGS_SECTIONS.map(s => {
          const Icon = s.icon;
          const selected = s.id === active;
          return (
            <li key={s.id} className={s.id === 'all' ? 'md:mt-3 md:pt-3 md:border-t md:border-gray-200' : ''}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={selected ? 'page' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors text-left ${
                  selected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-slate-700/60'
                }`}
              >
                <Icon size={16} className={selected ? 'text-white' : 'text-gray-400'} />
                {s.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SectionHeader({ section }: { section: SettingsSectionId }) {
  const s = SETTINGS_SECTIONS.find(x => x.id === section)!;
  const Icon = s.icon;
  return (
    <div className="flex items-center gap-3 pb-1">
      <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"><Icon size={22} /></div>
      <div>
        <h2 className="text-xl font-bold text-gray-800">{s.label}</h2>
        <p className="text-sm text-gray-500">{s.description}</p>
      </div>
    </div>
  );
}
