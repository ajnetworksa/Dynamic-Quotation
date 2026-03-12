import React, { useState, useEffect } from 'react';
import { Download, Upload, Database, AlertTriangle, CheckCircle2, XCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  }, []);

  const handleExportDB = async () => {
    setExportStatus('loading');
    try {
      const res = await fetch('/api/db/export');
      const data = await res.json();

      const wb = XLSX.utils.book_new();

      const wsCustomers = XLSX.utils.json_to_sheet(data.customers || []);
      XLSX.utils.book_append_sheet(wb, wsCustomers, 'Customers');

      const wsProducts = XLSX.utils.json_to_sheet(data.products || []);
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

      const wsQuotes = XLSX.utils.json_to_sheet(data.quotes || []);
      XLSX.utils.book_append_sheet(wb, wsQuotes, 'Quotes');

      const wsQuoteItems = XLSX.utils.json_to_sheet(data.quote_items || []);
      XLSX.utils.book_append_sheet(wb, wsQuoteItems, 'QuoteItems');

      XLSX.writeFile(wb, `AJ_Network_DB_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);

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
        const wb = XLSX.read(data, { type: 'array' });

        const payload: any = {};
        if (wb.SheetNames.includes('Customers')) {
          payload.customers = XLSX.utils.sheet_to_json(wb.Sheets['Customers']);
        }
        if (wb.SheetNames.includes('Products')) {
          payload.products = XLSX.utils.sheet_to_json(wb.Sheets['Products']);
        }
        if (wb.SheetNames.includes('Quotes')) {
          payload.quotes = XLSX.utils.sheet_to_json(wb.Sheets['Quotes']);
        }
        if (wb.SheetNames.includes('QuoteItems')) {
          payload.quote_items = XLSX.utils.sheet_to_json(wb.Sheets['QuoteItems']);
        }

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
      </div>
    </div>
  );
}
