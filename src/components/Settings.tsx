import React, { useState, useEffect } from 'react';
import { Download, Upload, Database, AlertTriangle, CheckCircle2, XCircle, Loader2, Image as ImageIcon, TerminalSquare, Trash2, ChevronDown, RefreshCw, Filter, Plus, X, Shield } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
const APP_VERSION = '1.3.0';

export default function Settings() {
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [logoStatus, setLogoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<number>(24); // default 24 (h-24)
  const [logoSizeStatus, setLogoSizeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [footerImageStatus, setFooterImageStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [currentFooterImage, setCurrentFooterImage] = useState<string | null>(null);

  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 465,
    user: '',
    pass: '',
    fromName: 'AJ Network Solutions'
  });

  const [themeStatus, setThemeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [themeColors, setThemeColors] = useState({
    headerBg: '#dcfce7',
    headerText: '#1f2937',
    stripeBg: '#e5e7eb',
    totalsBg: '#f3f4f6'
  });

  const [logs, setLogs] = useState<any[]>([]);
  const [logsStatus, setLogsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [logExpirationDays, setLogExpirationDays] = useState<number>(7);
  const [logExpirationStatus, setLogExpirationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // ── MU FILTERS ─────────────────────────────────────────────────────────────
  // zeroMarkupKeywords: item descriptions matching any of these contribute 0 profit to MU
  // excludedKeywords:   item descriptions matching any of these are skipped entirely from MU
  const [zeroMarkupKeywords, setZeroMarkupKeywords] = useState<string[]>(['Materials']);
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>(['Installation']);
  const [muFilterInput, setMuFilterInput] = useState({ zero: '', excluded: '' });
  const [muFilterStatus, setMuFilterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Workflow visibility: controls system-wide presence of buttons
  const [workflowVisibility, setWorkflowVisibility] = useState({
    invoice: true,
    template: true,
    email: true,
    print: true,
    preparedBy: true,
    showFeatureAccess: true,
    inspectionProtection: true
  });
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Row reorder mode: 'click' = up/down arrow buttons, 'drag' = drag-and-drop handles
  const [rowReorderMode, setRowReorderMode] = useState<'click' | 'drag'>('click');
  const [rowReorderStatus, setRowReorderStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Developer mode
  const [developerMode, setDeveloperMode] = useState(() => localStorage.getItem('developerMode') === 'true');
  const [devModeStatus, setDevModeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetch('/api/settings/logo')
      .then(res => res.json())
      .then(data => {
        if (data.value) setCurrentLogo(data.value);
      })
      .catch(console.error);

    fetch('/api/settings/logoSize')
      .then(res => res.json())
      .then(data => {
        if (data.value) setLogoSize(parseInt(data.value, 10));
      })
      .catch(console.error);

    fetch('/api/settings/footerImage')
      .then(res => res.json())
      .then(data => {
        if (data.value) setCurrentFooterImage(data.value);
      })
      .catch(console.error);

    fetch('/api/settings/smtpConfig')
      .then(res => res.json())
      .then(data => {
        if (data.value) setSmtpConfig(JSON.parse(data.value));
      })
      .catch(console.error);

    fetch('/api/settings/themeColors')
      .then(res => res.json())
      .then(data => {
        if (data.value) setThemeColors(JSON.parse(data.value));
      })
      .catch(console.error);

    fetch('/api/settings/logExpirationDays')
      .then(res => res.json())
      .then(data => {
        if (data.value) setLogExpirationDays(parseInt(data.value, 10));
      })
      .catch(console.error);

    fetch('/api/settings/muFilters')
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          const parsed = JSON.parse(data.value);
          if (parsed.zeroMarkup) setZeroMarkupKeywords(parsed.zeroMarkup);
          if (parsed.excluded) setExcludedKeywords(parsed.excluded);
        }
      })
      .catch(console.error);

    fetch('/api/settings/rowReorderMode')
      .then(res => res.json())
      .then(data => { if (data.value) setRowReorderMode(data.value as 'click' | 'drag'); })
      .catch(console.error);

    fetch('/api/settings/workflowVisibility')
      .then(res => res.json())
      .then(data => { if (data.value) setWorkflowVisibility(JSON.parse(data.value)); })
      .catch(console.error);

    fetch('/api/settings/developerMode')
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          const val = data.value === 'true';
          setDeveloperMode(val);
          localStorage.setItem('developerMode', String(val));
        }
      })
      .catch(console.error);
    if (user.role === 'admin') {
      fetchLogs();
    }
  }, []);

  const fetchLogs = async () => {
    try {
      setLogsStatus('loading');
      const res = await fetch('/api/admin/logs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
        setLogsStatus('success');
      } else {
        setLogsStatus('error');
      }
    } catch {
      setLogsStatus('error');
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all system logs?')) return;
    try {
      const res = await fetch('/api/admin/logs', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const handleSaveLogExpiration = async (days: number) => {
    setLogExpirationDays(days);
    setLogExpirationStatus('loading');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ key: 'logExpirationDays', value: days.toString() })
      });
      if (res.ok) {
        setLogExpirationStatus('success');
        setTimeout(() => setLogExpirationStatus('idle'), 3000);
      } else {
        setLogExpirationStatus('error');
      }
    } catch {
      setLogExpirationStatus('error');
    }
  };

  const handleExportDB = async () => {
    setExportStatus('loading');
    try {
      const res = await fetch('/api/db/export');
      const data = await res.json();

      const workbook = new ExcelJS.Workbook();

      const addSheet = (name: string, rows: any[]) => {
        const ws = workbook.addWorksheet(name);
        if (rows && rows.length > 0) {
          ws.columns = Object.keys(rows[0]).map(key => ({ header: key, key }));
          rows.forEach(row => ws.addRow(row));
        }
      };

      addSheet('Customers', data.customers || []);
      addSheet('Products', data.products || []);
      addSheet('Quotes', data.quotes || []);
      addSheet('QuoteItems', data.quote_items || []);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `AJ_Network_DB_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);

      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 5000);
    }
  };

  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('WARNING: Importing a database backup will overwrite all current data. Do you want to proceed?')) {
      e.target.value = '';
      return;
    }

    setImportStatus('loading');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const data = new Uint8Array(arrayBuffer);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const payload: any = {};
        
        const sheetToJson = (sheet: ExcelJS.Worksheet) => {
          const rows: any[] = [];
          const headers: string[] = [];
          sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
              row.eachCell((cell, colNumber) => {
                headers[colNumber] = cell.value?.toString() || '';
              });
            } else {
              const rowData: any = {};
              row.eachCell((cell, colNumber) => {
                const header = headers[colNumber];
                if (header) {
                  rowData[header] = cell.value;
                }
              });
              rows.push(rowData);
            }
          });
          return rows;
        };

        const customersSheet = workbook.getWorksheet('Customers');
        if (customersSheet) payload.customers = sheetToJson(customersSheet);

        const productsSheet = workbook.getWorksheet('Products');
        if (productsSheet) payload.products = sheetToJson(productsSheet);

        const quotesSheet = workbook.getWorksheet('Quotes');
        if (quotesSheet) payload.quotes = sheetToJson(quotesSheet);

        const quoteItemsSheet = workbook.getWorksheet('QuoteItems');
        if (quoteItemsSheet) payload.quote_items = sheetToJson(quoteItemsSheet);

        const res = await fetch('/api/db/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          setImportStatus('success');
          setTimeout(() => {
            setImportStatus('idle');
            window.location.reload();
          }, 2000);
        } else {
          const errorData = await res.json();
          console.error('Import failed:', errorData);
          if (errorData.details && errorData.details.length > 0) {
            console.table(errorData.details.map((d: string) => ({ error: d })));
            const detailLines = errorData.details.map((d: string) => `• ${d}`).join('\n');
            alert(`Import failed — the following rows could not be imported:\n\n${detailLines}`);
          } else {
            alert(`Import failed: ${errorData.error || 'Unknown error'}`);
          }
          setImportStatus('error');
          setTimeout(() => setImportStatus('idle'), 5000);
        }
      } catch (error) {
        console.error('Import error:', error);
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 5000);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoStatus('loading');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'logo', value: base64 })
        });

        if (res.ok) {
          setCurrentLogo(base64);
          setLogoStatus('success');
          setTimeout(() => setLogoStatus('idle'), 3000);
        } else {
          setLogoStatus('error');
          setTimeout(() => setLogoStatus('idle'), 5000);
        }
      } catch (error) {
        console.error('Logo upload error:', error);
        setLogoStatus('error');
        setTimeout(() => setLogoStatus('idle'), 5000);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFooterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFooterImageStatus('loading');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'footerImage', value: base64 })
        });

        if (res.ok) {
          setCurrentFooterImage(base64);
          setFooterImageStatus('success');
          setTimeout(() => setFooterImageStatus('idle'), 3000);
        } else {
          setFooterImageStatus('error');
          setTimeout(() => setFooterImageStatus('idle'), 5000);
        }
      } catch (error) {
        console.error('Footer upload error:', error);
        setFooterImageStatus('error');
        setTimeout(() => setFooterImageStatus('idle'), 5000);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSmtpSave = async () => {
    setSmtpStatus('loading');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'smtpConfig', value: JSON.stringify(smtpConfig) })
      });
      if (res.ok) {
        setSmtpStatus('success');
      } else {
        setSmtpStatus('error');
      }
    } catch {
      setSmtpStatus('error');
    }
    setTimeout(() => setSmtpStatus('idle'), 3000);
  };

  const handleWorkflowToggle = async (key: keyof typeof workflowVisibility) => {
    const next = { ...workflowVisibility, [key]: !workflowVisibility[key] };
    setWorkflowVisibility(next);
    setWorkflowStatus('loading');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'workflowVisibility', value: JSON.stringify(next) })
      });
      if (res.ok) {
        setWorkflowStatus('success');
        setTimeout(() => setWorkflowStatus('idle'), 2000);
      } else setWorkflowStatus('error');
    } catch { setWorkflowStatus('error'); }
  };

  const handleThemeSave = async () => {
    setThemeStatus('loading');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'themeColors', value: JSON.stringify(themeColors) })
      });
      if (res.ok) {
        setThemeStatus('success');
      } else {
        setThemeStatus('error');
      }
    } catch {
      setThemeStatus('error');
    }
    setTimeout(() => setThemeStatus('idle'), 3000);
  };

  const handleMuFilterSave = async () => {
    setMuFilterStatus('loading');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'muFilters',
          value: JSON.stringify({ zeroMarkup: zeroMarkupKeywords, excluded: excludedKeywords })
        })
      });
      if (res.ok) {
        setMuFilterStatus('success');
      } else {
        setMuFilterStatus('error');
      }
    } catch {
      setMuFilterStatus('error');
    }
    setTimeout(() => setMuFilterStatus('idle'), 3000);
  };

  const handleRowReorderToggle = async (val: 'click' | 'drag') => {
    setRowReorderMode(val);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'rowReorderMode', value: val })
      });
      setRowReorderStatus('success');
    } catch {
      setRowReorderStatus('error');
    }
    setTimeout(() => setRowReorderStatus('idle'), 2000);
  };

  const handleDevModeToggle = async (val: boolean) => {
    setDeveloperMode(val);
    localStorage.setItem('developerMode', String(val)); // instant effect for open QuoteForm tabs
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'developerMode', value: String(val) })
      });
      setDevModeStatus('success');
    } catch {
      setDevModeStatus('error');
    }
    setTimeout(() => setDevModeStatus('idle'), 2000);
  };
  const handleDownloadSystemDB = async () => {
    try {
      const res = await fetch('/api/admin/backup');
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Failed to download backup: ${errorData.error}`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AJ_Network_DB_Backup_${new Date().toISOString().split('T')[0]}.db`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading backup');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
          <Database className="text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">Database Management</h2>
        </div>

        <div className="p-6 space-y-8">
          {/* Export Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Export Database</h3>
            <p className="text-gray-600 mb-4 text-sm">
              Download a complete backup of your customers, products, and quotes data in Excel format.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={handleExportDB}
                disabled={exportStatus === 'loading'}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70"
              >
                {exportStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {exportStatus === 'loading' ? 'Exporting...' : 'Export Backup'}
              </button>

              {exportStatus === 'success' && (
                <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                  <CheckCircle2 size={16} /> Export successful
                </span>
              )}
              {exportStatus === 'error' && (
                <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                  <XCircle size={16} /> Export failed
                </span>
              )}
            </div>

            <h3 className="text-lg font-medium text-gray-900 mt-8 mb-2">System Backup (Raw DB)</h3>
            <p className="text-gray-600 mb-4 text-sm">
              Directly download the underlying SQLite `.db` master file.
            </p>
            <button
              onClick={handleDownloadSystemDB}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Database size={18} /> Download Master File
            </button>
          </div>

          <hr className="border-gray-200" />

          {/* Import Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
              Import Database
              <AlertTriangle size={18} className="text-amber-500" />
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              Restore your database from a previous Excel backup file.
              <strong className="text-red-600 block mt-1">Warning: This will completely replace all existing data.</strong>
            </p>

            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleImportDB}
                  disabled={importStatus === 'loading'}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <button
                  disabled={importStatus === 'loading'}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {importStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {importStatus === 'loading' ? 'Importing...' : 'Select Backup File'}
                </button>
              </div>

              {importStatus === 'success' && (
                <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                  <CheckCircle2 size={16} /> Import successful! Reloading...
                </span>
              )}
              {importStatus === 'error' && (
                <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                  <XCircle size={16} /> Import failed
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
          <ImageIcon className="text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">Logo Setup</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4 text-sm">
            Upload your company logo. This logo will automatically appear on the Quote Form and in exported PDFs.
          </p>

          <div className="flex items-start gap-8">
            <div className="flex-1">
              <div className="relative inline-block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={logoStatus === 'loading'}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <button
                  disabled={logoStatus === 'loading'}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {logoStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {logoStatus === 'loading' ? 'Uploading...' : 'Upload New Logo'}
                </button>
              </div>

              <div className="mt-3 h-6">
                {logoStatus === 'success' && (
                  <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                    <CheckCircle2 size={16} /> Logo updated successfully
                  </span>
                )}
                {logoStatus === 'error' && (
                  <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                    <XCircle size={16} /> Failed to upload logo
                  </span>
                )}
              </div>

              <div className="mt-6 border-t border-gray-100 pt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adjust Logo Size
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="16"
                    max="64"
                    value={logoSize}
                    onChange={(e) => setLogoSize(parseInt(e.target.value, 10))}
                    onMouseUp={async () => {
                      setLogoSizeStatus('loading');
                      try {
                        const res = await fetch('/api/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ key: 'logoSize', value: logoSize.toString() })
                        });
                        if (res.ok) {
                          setLogoSizeStatus('success');
                          setTimeout(() => setLogoSizeStatus('idle'), 3000);
                        } else {
                          setLogoSizeStatus('error');
                        }
                      } catch (e) {
                        setLogoSizeStatus('error');
                      }
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-gray-600 text-sm font-mono w-8">{logoSize}</span>
                </div>
                <div className="mt-2 h-4">
                  {logoSizeStatus === 'success' && (
                    <span className="text-emerald-600 text-xs font-medium">Size saved</span>
                  )}
                  {logoSizeStatus === 'error' && (
                    <span className="text-red-600 text-xs font-medium">Failed to save size</span>
                  )}
                </div>
              </div>
            </div>

            <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
              {currentLogo ? (
                <img src={currentLogo} alt="Current Logo" className="max-w-full max-h-full object-contain p-2" />
              ) : (
                <span className="text-gray-400 text-sm text-center px-4">No logo uploaded</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Image Setup */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
          <ImageIcon className="text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">Footer Image Setup</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4 text-sm">
            Upload a footer image (like a signature, stamp, or company details block). This image will automatically appear at the bottom of the Quote Form and exported PDFs.
          </p>

          <div className="flex items-start gap-8">
            <div className="flex-1">
              <div className="relative inline-block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFooterUpload}
                  disabled={footerImageStatus === 'loading'}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <button
                  disabled={footerImageStatus === 'loading'}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {footerImageStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {footerImageStatus === 'loading' ? 'Uploading...' : 'Upload New Footer'}
                </button>
              </div>

              <div className="mt-3 h-6">
                {footerImageStatus === 'success' && (
                  <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                    <CheckCircle2 size={16} /> Footer image updated successfully
                  </span>
                )}
                {footerImageStatus === 'error' && (
                  <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                    <XCircle size={16} /> Failed to upload footer image
                  </span>
                )}
              </div>
            </div>

            <div className="w-64 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
              {currentFooterImage ? (
                <img src={currentFooterImage} alt="Current Footer" className="max-w-full max-h-full object-contain p-2" />
              ) : (
                <span className="text-gray-400 text-sm text-center px-4">No footer uploaded</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Theme Colors Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-800">Theme Colors Setup</h2>
          </div>
          <button
            onClick={handleThemeSave}
            disabled={themeStatus === 'loading'}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {themeStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 'Save Colors'}
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-6 text-sm">
            Customize the colors used in the Quote Form and exported PDFs.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Table Header Background</label>
              <div className="flex items-center gap-3">
                <input type="color" value={themeColors.headerBg} onChange={e => setThemeColors({ ...themeColors, headerBg: e.target.value })} className="w-12 h-12 p-1 border border-gray-300 rounded cursor-pointer" />
                <span className="font-mono text-gray-500 text-sm">{themeColors.headerBg}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Table Header Text</label>
              <div className="flex items-center gap-3">
                <input type="color" value={themeColors.headerText} onChange={e => setThemeColors({ ...themeColors, headerText: e.target.value })} className="w-12 h-12 p-1 border border-gray-300 rounded cursor-pointer" />
                <span className="font-mono text-gray-500 text-sm">{themeColors.headerText}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Alternating Row (Stripe)</label>
              <div className="flex items-center gap-3">
                <input type="color" value={themeColors.stripeBg} onChange={e => setThemeColors({ ...themeColors, stripeBg: e.target.value })} className="w-12 h-12 p-1 border border-gray-300 rounded cursor-pointer" />
                <span className="font-mono text-gray-500 text-sm">{themeColors.stripeBg}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Totals Box Background</label>
              <div className="flex items-center gap-3">
                <input type="color" value={themeColors.totalsBg} onChange={e => setThemeColors({ ...themeColors, totalsBg: e.target.value })} className="w-12 h-12 p-1 border border-gray-300 rounded cursor-pointer" />
                <span className="font-mono text-gray-500 text-sm">{themeColors.totalsBg}</span>
              </div>
            </div>
          </div>
          <div className="mt-6 h-6">
            {themeStatus === 'success' && <span className="text-emerald-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 size={16} /> Theme colors saved successfully</span>}
            {themeStatus === 'error' && <span className="text-red-600 text-sm font-medium flex items-center gap-1"><XCircle size={16} /> Failed to save theme colors</span>}
          </div>
        </div>
      </div>

      {/* SMTP Email Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-800">SMTP Server settings</h2>
          </div>
          <button
            onClick={handleSmtpSave}
            disabled={smtpStatus === 'loading'}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {smtpStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 'Save Config'}
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-6 text-sm">
            Configure your SMTP server here to allow sending Quotations and Invoices directly to clients via email.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Host Server</label>
              <input type="text" placeholder="smtp.gmail.com" value={smtpConfig.host} onChange={e => setSmtpConfig({ ...smtpConfig, host: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input type="number" placeholder="465" value={smtpConfig.port} onChange={e => setSmtpConfig({ ...smtpConfig, port: parseInt(e.target.value, 10) })} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username / Email</label>
              <input type="text" placeholder="user@company.com" value={smtpConfig.user} onChange={e => setSmtpConfig({ ...smtpConfig, user: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password / App Password</label>
              <input type="password" placeholder="••••••••" value={smtpConfig.pass} onChange={e => setSmtpConfig({ ...smtpConfig, pass: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
              <input type="text" placeholder="AJ Network Solutions" value={smtpConfig.fromName} onChange={e => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })} className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="mt-4 h-6">
            {smtpStatus === 'success' && <span className="text-emerald-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 size={16} /> SMTP configuration saved</span>}
            {smtpStatus === 'error' && <span className="text-red-600 text-sm font-medium flex items-center gap-1"><XCircle size={16} /> Failed to save SMTP details</span>}
          </div>
        </div>
      </div>

      {/* System Logs (Admin Only) */}
      {user.role === 'admin' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <TerminalSquare className="text-gray-700" />
              <h2 className="text-xl font-semibold text-gray-800">System Logs</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Expire:</span>
                <div className="relative">
                  <select
                    value={logExpirationDays}
                    onChange={(e) => handleSaveLogExpiration(parseInt(e.target.value, 10))}
                    className="appearance-none pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="1">1 Day</option>
                    <option value="2">2 Days</option>
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                    <option value="30">30 Days</option>
                    <option value="0">Never</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
              <button
                onClick={fetchLogs}
                disabled={logsStatus === 'loading'}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                <RefreshCw size={16} className={logsStatus === 'loading' ? 'animate-spin' : ''} /> Refresh
              </button>
              <button
                onClick={handleClearLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 size={16} /> Clear Logs
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <p className="text-gray-600 mb-4 text-sm">
              Displays backend errors, database execution failures, and AI exceptions for troubleshooting.
              <span className="ml-2 text-indigo-600">
                {logExpirationStatus === 'loading' && 'Saving expiration...'}
                {logExpirationStatus === 'success' && 'Expiration saved!'}
                {logExpirationStatus === 'error' && 'Failed to save expiration.'}
              </span>
            </p>

            {logsStatus === 'loading' ? (
              <div className="flex items-center gap-2 text-gray-500 justify-center py-8">
                <Loader2 size={18} className="animate-spin" /> Loading logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                No system errors logged.
              </div>
            ) : (
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="p-3 font-medium">Timestamp</th>
                      <th className="p-3 font-medium">Source</th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 font-medium">Message</th>
                      <th className="p-3 font-medium text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.map((log) => (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="p-3 text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                              {log.source}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-semibold">
                              {log.type}
                            </span>
                          </td>
                          <td className="p-3 text-gray-800 truncate max-w-xs">{log.message}</td>
                          <td className="p-3 text-right">
                            {log.details && (
                              <button
                                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                className="text-indigo-600 hover:text-indigo-800 text-xs font-medium underline"
                              >
                                {expandedLogId === log.id ? 'Hide Details' : 'View Details'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedLogId === log.id && log.details && (
                          <tr className="bg-gray-800">
                            <td colSpan={5} className="p-0">
                              <pre className="p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono m-0">
                                {log.details}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MU Calculation Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter className="text-indigo-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-800">MU Calculation Filters</h2>
              <p className="text-sm text-gray-500 mt-0.5">Control which item types are included in the Markup Profit (MU) calculation</p>
            </div>
          </div>
          <button
            onClick={handleMuFilterSave}
            disabled={muFilterStatus === 'loading'}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {muFilterStatus === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 'Save Filters'}
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Zero Markup List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Zero Markup Keywords</h3>
            <p className="text-xs text-gray-500 mb-3">
              Items whose description contains any of these words are included in MU but contribute <strong>zero profit</strong> (their base cost = their sale price).
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="e.g. Materials"
                value={muFilterInput.zero}
                onChange={e => setMuFilterInput(f => ({ ...f, zero: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && muFilterInput.zero.trim()) {
                    const kw = muFilterInput.zero.trim();
                    if (!zeroMarkupKeywords.includes(kw)) setZeroMarkupKeywords(prev => [...prev, kw]);
                    setMuFilterInput(f => ({ ...f, zero: '' }));
                  }
                }}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={() => {
                  const kw = muFilterInput.zero.trim();
                  if (kw && !zeroMarkupKeywords.includes(kw)) setZeroMarkupKeywords(prev => [...prev, kw]);
                  setMuFilterInput(f => ({ ...f, zero: '' }));
                }}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {zeroMarkupKeywords.map(kw => (
                <span key={kw} className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-sm font-medium">
                  {kw}
                  <button onClick={() => setZeroMarkupKeywords(prev => prev.filter(k => k !== kw))} className="hover:text-red-600 transition-colors">
                    <X size={13} />
                  </button>
                </span>
              ))}
              {zeroMarkupKeywords.length === 0 && <span className="text-xs text-gray-400 italic">No keywords added</span>}
            </div>
          </div>

          {/* Excluded List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Excluded Keywords</h3>
            <p className="text-xs text-gray-500 mb-3">
              Items whose description contains any of these words are <strong>completely excluded</strong> from the MU calculation (neither profit nor cost).
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="e.g. Installation"
                value={muFilterInput.excluded}
                onChange={e => setMuFilterInput(f => ({ ...f, excluded: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && muFilterInput.excluded.trim()) {
                    const kw = muFilterInput.excluded.trim();
                    if (!excludedKeywords.includes(kw)) setExcludedKeywords(prev => [...prev, kw]);
                    setMuFilterInput(f => ({ ...f, excluded: '' }));
                  }
                }}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={() => {
                  const kw = muFilterInput.excluded.trim();
                  if (kw && !excludedKeywords.includes(kw)) setExcludedKeywords(prev => [...prev, kw]);
                  setMuFilterInput(f => ({ ...f, excluded: '' }));
                }}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {excludedKeywords.map(kw => (
                <span key={kw} className="flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200 text-red-800 rounded-full text-sm font-medium">
                  {kw}
                  <button onClick={() => setExcludedKeywords(prev => prev.filter(k => k !== kw))} className="hover:text-red-600 transition-colors">
                    <X size={13} />
                  </button>
                </span>
              ))}
              {excludedKeywords.length === 0 && <span className="text-xs text-gray-400 italic">No keywords added</span>}
            </div>
          </div>

        </div>
        <div className="px-6 pb-4 h-6">
          {muFilterStatus === 'success' && <span className="text-emerald-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 size={16} /> MU filters saved successfully</span>}
          {muFilterStatus === 'error' && <span className="text-red-600 text-sm font-medium flex items-center gap-1"><XCircle size={16} /> Failed to save MU filters</span>}
        </div>
      </div>

      {/* Access Control: Workflow Visibility */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Access Control</h2>
            <p className="text-sm text-gray-500 mt-0.5">Toggle system-wide visibility for key workflow buttons</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { id: 'invoice', label: 'Invoice Button', desc: 'Convert Quote to Tax Invoice' },
              { id: 'template', label: 'Save Template', desc: 'Save reusable term templates' },
              { id: 'email', label: 'Email Button', desc: 'Send Quote via SMTP' },
              { id: 'print', label: 'Print Button', desc: 'Open browser print dialog' },
              { id: 'preparedBy', label: 'Prepared By', desc: 'Show "Prepared By" on documents' },
              { id: 'showFeatureAccess', label: 'Feature Access', desc: 'Show feature list in profile menu' },
            ].map((btn) => (
              <div
                key={btn.id}
                onClick={() => handleWorkflowToggle(btn.id as any)}
                className={`flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  workflowVisibility[btn.id as keyof typeof workflowVisibility]
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-800">{btn.label}</span>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${workflowVisibility[btn.id as keyof typeof workflowVisibility] ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${workflowVisibility[btn.id as keyof typeof workflowVisibility] ? 'left-5.5' : 'left-0.5'}`} style={{ transform: workflowVisibility[btn.id as keyof typeof workflowVisibility] ? 'translateX(20px)' : 'translateX(0)' }}></div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">{btn.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end h-4">
            {workflowStatus === 'loading' && <Loader2 size={16} className="animate-spin text-indigo-600" />}
            {workflowStatus === 'success' && <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1"><CheckCircle2 size={14} /> Workflow settings updated</span>}
            {workflowStatus === 'error' && <span className="text-red-600 text-xs font-semibold flex items-center gap-1"><XCircle size={14} /> Failed to save settings</span>}
          </div>
        </div>
      </div>

      {/* Row Reorder Mode */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">⠿</div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Row Reorder Mode</h2>
            <p className="text-sm text-gray-500 mt-0.5">Choose how items are reordered in the Quote Form</p>
          </div>
        </div>
        <div className="p-6 flex items-center justify-between gap-8">
          <div className="space-y-3 flex-1">
            <div
              onClick={() => handleRowReorderToggle('click')}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                rowReorderMode === 'click' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                rowReorderMode === 'click' ? 'border-indigo-500' : 'border-gray-300'
              }`}>
                {rowReorderMode === 'click' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
              </div>
              <div>
                <p className="font-semibold text-gray-800">↑ ↓ Click Arrows</p>
                <p className="text-sm text-gray-500 mt-0.5">Up and down arrow buttons appear beside each row. Click once per step to move rows.</p>
              </div>
            </div>
            <div
              onClick={() => handleRowReorderToggle('drag')}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                rowReorderMode === 'drag' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                rowReorderMode === 'drag' ? 'border-indigo-500' : 'border-gray-300'
              }`}>
                {rowReorderMode === 'drag' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
              </div>
              <div>
                <p className="font-semibold text-gray-800">⠿ Drag &amp; Drop</p>
                <p className="text-sm text-gray-500 mt-0.5">A grip handle replaces the arrows. Click and drag any row to reorder it instantly.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            {rowReorderStatus === 'success' && <span className="text-emerald-600 text-xs font-medium">Saved ✓</span>}
            {rowReorderStatus === 'error' && <span className="text-red-600 text-xs font-medium">Save failed</span>}
          </div>
        </div>
      </div>

      {/* Developer Mode */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 font-mono font-bold text-sm">&lt;/&gt;</div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Developer Mode</h2>
            <p className="text-sm text-gray-500 mt-0.5">Reveals formula audit information in the Analysis Sidebar — like Excel&apos;s formula view</p>
          </div>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-gray-700">When <strong>ON</strong>, the Analysis Sidebar shows a <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">RULE</span> column for each item:</p>
            <ul className="text-xs text-gray-500 mt-2 space-y-1 ml-3">
              <li><span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold mr-1">EXCL</span> Item is excluded from MU entirely</li>
              <li><span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold mr-1">ZM</span> Zero markup — base cost equals sale price</li>
              <li><span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold mr-1">MAN</span> Manual base cost override is active</li>
              <li><span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-bold mr-1">DB</span> Using original DB price as base cost</li>
              <li><span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold mr-1">--</span> No base price known</li>
            </ul>
            <p className="text-xs text-gray-400 mt-3">Toggle takes effect immediately. Turn off to hide formula details from regular users.</p>
          </div>
          <div className="flex flex-col items-center gap-2 ml-8">
            <button
              onClick={() => handleDevModeToggle(!developerMode)}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none ${
                developerMode ? 'bg-purple-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${
                developerMode ? 'translate-x-9' : 'translate-x-1'
              }`} />
            </button>
            <span className={`text-xs font-semibold ${developerMode ? 'text-purple-700' : 'text-gray-400'}`}>
              {developerMode ? 'ON' : 'OFF'}
            </span>
            {devModeStatus === 'success' && <span className="text-emerald-600 text-xs">Saved</span>}
            {devModeStatus === 'error' && <span className="text-red-600 text-xs">Save failed</span>}
          </div>
        </div>

        {/* Inspection Protection Toggle within Developer Section */}
        <div className="px-6 py-4 bg-purple-50/50 border-t border-purple-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-purple-600" />
            <div>
              <p className="text-sm font-bold text-gray-800">Source Inspection Protection</p>
              <p className="text-xs text-gray-500">Disable Right-Click and DevTools shortcuts (F12, Ctrl+Shift+I) for non-admins.</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => handleWorkflowToggle('inspectionProtection' as any)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${
                workflowVisibility.inspectionProtection ? 'bg-purple-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                workflowVisibility.inspectionProtection ? 'translate-x-8' : 'translate-x-1'
              }`} />
            </button>
            <span className={`text-[10px] font-bold ${workflowVisibility.inspectionProtection ? 'text-purple-700' : 'text-gray-400'}`}>
              {workflowVisibility.inspectionProtection ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>
        </div>
      </div>
      
      {/* App Version Footer */}
      <div className="pt-8 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-mono border border-gray-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          AJ Quotation System v{APP_VERSION}
        </div>
        <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">Powered by AJ Network Solutions</p>
      </div>
    </div>
  );
}
