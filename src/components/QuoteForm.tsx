// =============================================================================
// QuoteForm.tsx — Main Quote/Invoice Document Builder
// =============================================================================
// This file controls everything you see on the "Docs" page:
//   - The actionbar (Clear / Record / Email / Print / Export buttons)
//   - The printable quote document (header, customer info, items table, totals)
//   - Terms & Conditions section
//   - PDF and Excel export logic
//
// HOW TO CUSTOMISE:
//   • DEFAULT TEXT (note, payment, warranty…) → find the useState blocks ~line 75–92
//   • TABLE HEADER COLOR                      → search for backgroundColor: '#dcfce7'
//   • BORDER COLOR                            → search for borderColor: '#1f2937'
//   • TOTAL BOX "TOTAL PACKAGE" COLOR         → search for bg-green-100 / text-green-800
//   • COMPANY NAME in fallback logo           → search for "AJ Network Solutions"
//   • PDF RESOLUTION/QUALITY                  → search for scale: 2 and 'JPEG', 0.8
//   • LOGO SIZE CONTROL                       → search for logoSize state and h-{logoSize}
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Plus, Trash2, Save, Printer, RefreshCw, Download, FileSpreadsheet, Send, Loader2, ArrowUp, ArrowDown, Copy, Bookmark, BookOpen, Languages, ChevronDown, Search, Bot, GripVertical, AlertTriangle, Users, FileText, StickyNote } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Safe UUID/ID generator for non-HTTPS or older environments
const generateId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) { }
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

interface Customer {
  id: number;
  name: string;
  address: string;
  contact: string;
  mobile: string;
  email: string;
}

interface Product {
  id: number;
  description: string;
  description_ar?: string;
  unit: string;
  unit_price: number;
}

interface QuoteItem {
  id: string;
  product_id?: number;
  original_price?: number; // DB price at the time of product selection
  description: string;
  description_ar?: string;
  qty: number;
  unit: string;
  unit_price: number;
  net_price: number;
  manual_price?: number;
  costShift?: 'up' | 'down';
  internal_note?: string;
}

interface CustomField {
  id: string;
  header: string;
  value: string;
  valueAr: string;
}

interface ThemeColors {
  headerBg: string;
  headerText: string;
  stripeBg: string;
  totalsBg: string;
}

export default function QuoteForm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const recallQuoteId = searchParams.get('recall');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [footerImageUrl, setFooterImageUrl] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRfqLoading, setIsRfqLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── SIDEBAR ALIGNMENT REFS ──────────────────────────────────────────────
  // printRef wraps the actual document. formTopRef wraps the header section
  // up to the items table. This allows the Analysis Sidebar (which sits 
  // outside the form) to align its table header perfectly with the 
  // document's items table.
  const printRef = useRef<HTMLDivElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);
  const [formTopHeight, setFormTopHeight] = useState<number>(0);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  // logoSize is loaded from the Admin Settings page (Settings → Logo Size).
  // The number maps to a Tailwind spacing unit: 24 = h-24 = 6rem ≈ 96px tall.
  // You can change the default here, but it will be overridden by whatever is
  // saved in the database via the Settings page.
  const [logoSize, setLogoSize] = useState(24);
  const [stampSize, setStampSize] = useState(140);
  const [stampOffsetX, setStampOffsetX] = useState(0);
  const [stampOffsetY, setStampOffsetY] = useState(0);
  const [termsFontSize, setTermsFontSize] = useState(14); // Default 14px
  const [themeColors, setThemeColors] = useState<ThemeColors>({
    headerBg: "#039737a6",
    headerText: "#1f2937",
    stripeBg: "#f9fafb",
    totalsBg: "#f3f4f6"
  });

  // MU filter keywords loaded from Settings → Admin → "MU Calculation Filters"
  // zeroMarkup: items matching these keywords have 0 markup (base = net price)
  // excluded:   items matching these keywords are skipped entirely from MU
  const [muFilters, setMuFilters] = useState<{ zeroMarkup: string[]; excluded: string[] }>({
    zeroMarkup: [],
    excluded: [],
  });

  // Developer mode: when ON, the Analysis Sidebar shows a RULE column
  // auditing which MU formula applies to each row (like Excel's formula audit).
  // Persisted in localStorage so it survives page navigations.
  // Row reorder mode — loaded from Settings. 'click' = arrows, 'drag' = drag handles.
  const [rowReorderMode, setRowReorderMode] = useState<'click' | 'drag'>('drag');
  // Drag-and-drop state: which row index is being dragged, and which is the current drop target.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [developerMode, setDeveloperMode] = useState(() => localStorage.getItem('developerMode') === 'true');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [quoteId, setQuoteId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFocused, setCustomerFocused] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [priceAlert, setPriceAlert] = useState<{ type: 'increase' | 'decrease' | 'mixed'; count: number } | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [focusedDescriptionIndex, setFocusedDescriptionIndex] = useState<number | null>(null);
  const descriptionRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const blurTimeoutRef = useRef<NodeJS.Timeout>();
  // Measured position of the active description textarea — updated by useEffect so it's always fresh
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  // Standalone modal for adding a new product (outside textarea focus chain)
  const [addProductModal, setAddProductModal] = useState<{ rowIndex: number; description: string; unit: string; price: string; isSaving?: boolean } | null>(null);
  const [addCustomerModal, setAddCustomerModal] = useState<{ name: string; mobile: string; address: string; contact: string; email: string; isSaving?: boolean } | null>(null);
  // Rows currently being translated (shows inline indicator)
  const [translatingRows, setTranslatingRows] = useState<Set<number>>(new Set());
  // Which row has its private note expanded (null = none)
  const [expandedNoteIndex, setExpandedNoteIndex] = useState<number | null>(null);

  const [subject, setSubject] = useState('');
  const [subjectAr, setSubjectAr] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [itemsHistory, setItemsHistory] = useState<QuoteItem[][]>([]);
  const [discount, setDiscount] = useState(0);
  const [status, setStatus] = useState('Draft');
  const [type, setType] = useState('Quotation');
  const [version, setVersion] = useState(1);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [authorId, setAuthorId] = useState<number | null>(null);
  const [usersList, setUsersList] = useState<{id: number, username: string, name: string}[]>([]);
  const [groupsList, setGroupsList] = useState<{id: number, name: string, members: number[]}[]>([]);
  const [sharedWith, setSharedWith] = useState<{users: number[], groups: number[], canEditUsers: number[], canEditGroups: number[]}>({users: [], groups: [], canEditUsers: [], canEditGroups: []});
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [workflowVisibility, setWorkflowVisibility] = useState({
    invoice: true,
    template: true,
    email: true,
    print: true,
    preparedBy: true,
    shareWith: true
  });

  // Global markup percentage added for automated pricing.
  // When products are added from the DB, their unit_price is calculated as:
  // original_price * (1 + markup / 100).
  const [markup, setMarkup] = useState(8);

  // ── ROW HEIGHT SYNCING ──────────────────────────────────────────────────
  // rowRefs tracks the DOM elements of the main table rows.
  // rowHeights stores their current pixel heights so the Sidebar can 
  // match them exactly (synchronizing the analysis rows with table rows).
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  const [headerHeight, setHeaderHeight] = useState<number>(44);

  // ── DYNAMIC SYNCING LOGIC ───────────────────────────────────────────────
  // Uses ResizeObserver to monitor changes in the form top section (header/customer info)
  // and each individual row in the items table.
  useEffect(() => {
    let animationFrameId: number;
    const updateHeights = () => {
      animationFrameId = window.requestAnimationFrame(() => {
        if (headerRef.current) {
          setHeaderHeight(headerRef.current.getBoundingClientRect().height);
        }
        const heights = rowRefs.current.map(el => el ? el.getBoundingClientRect().height : 40);
        setRowHeights(heights);
        if (formTopRef.current) {
          setFormTopHeight(formTopRef.current.getBoundingClientRect().height);
        }
      });
    };

    const observer = new ResizeObserver(updateHeights);
    if (headerRef.current) observer.observe(headerRef.current);
    if (formTopRef.current) observer.observe(formTopRef.current);
    rowRefs.current.forEach(el => {
      if (el) observer.observe(el);
    });

    updateHeights();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [items]);

  // AUTOMATIC PRICING UPDATE:
  // When the global markup percentage changes, recalculate all item prices
  // EXCEPT for those where a manual price override has been set.
  useEffect(() => {
    setItems(prevItems => prevItems.map(item => {
      if ((item.manual_price !== undefined && item.manual_price !== null) || item.original_price === undefined || item.original_price === null) {
        return item;
      }
      const newUnitPrice = item.original_price * (1 + markup / 100);
      return {
        ...item,
        unit_price: newUnitPrice,
        net_price: newUnitPrice * item.qty
      };
    }));
  }, [markup]);
  // ── DEFAULT VAT RATE ──────────────────────────────────────────────────────
  // Change 15 to any number (e.g. 5 for 5%).  The user can also edit it live
  // in the totals box on the right side of the form.
  const [vatRate, setVatRate] = useState(15);

  // ── DEFAULT TERMS & CONDITIONS TEXT ─────────────────────────────────────
  // These are the default values that appear every time you open a NEW quote.
  // The user can edit them directly on the form; the changes are saved with
  // the quote but do NOT permanently change these defaults.
  //
  // To permanently change a default:
  //   1. Find the line below for that field (e.g. payment, warranty, etc.)
  //   2. Replace the text inside the single-quotes '...' with your new default.
  //   3. Save this file and restart the server (npm run dev).
  //
  // English and Arabic versions are stored separately.
  // The Arabic text is auto-generated by Google Translate when you type in
  // English and click away from the field — you can also edit it manually.

  // Header label for the note section (editable on the form).
  // Change 'NOTE:' to any label, e.g. 'IMPORTANT:' or 'REMARKS:'
  const [noteHeader, setNoteHeader] = useState('NOTE:');

  // Main notice / note that appears at the top of the Terms section.
  // Use \n to add a new line.
  const [note, setNote] = useState('Any additional work|device will be considered Change Order\nInternet source is provided by the OWNER');
  const [noteAr, setNoteAr] = useState('سيتم اعتبار أي عمل إضافي | جهاز بمثابة أمر تغيير\nيتم توفير مصدر الإنترنت من قبل المالك');
  const [lastNoteTrigger, setLastNoteTrigger] = useState(note); // tracks last translated note to avoid retranslating unchanged text

  // Payment terms shown on the quote.
  const [payment, setPayment] = useState('Full Payment in ADVANCE');
  const [paymentAr, setPaymentAr] = useState('الدفع الكامل مقدما');

  // Warranty terms.
  const [warranty, setWarranty] = useState("2 YEARS limited warranty and/or supplier's recommendation");
  const [warrantyAr, setWarrantyAr] = useState('ضمان محدود لمدة عامين و/أو توصية المورد');

  // Number of workers / technicians for the project.
  const [manpower, setManpower] = useState('2 Technicians, 1 Supervisor');
  const [manpowerAr, setManpowerAr] = useState('فنيين، 1 مشرف 2');

  // How long before team can mobilize / start the work.
  const [mobilization, setMobilization] = useState('3-4 days upon confirmation of payment');
  const [mobilizationAr, setMobilizationAr] = useState('أيام بعد تأكيد الدفع 4-3');

  // How long the work itself will take.
  const [duration, setDuration] = useState('1-2 Working Days');
  const [durationAr, setDurationAr] = useState('أيام عمل 2-1');

  // Bank/payment details.  Use \n for line breaks.
  // ⚠️ Change this to YOUR company's bank account information!
  const [bankDetails, setBankDetails] = useState('ALINMA BANK - Account: 68206662020000\nIBAN: SA0305000068206662020000 ABDULMOSHIN\nABDULAZIZ AL-JABR TRADING CO.');
  const [bankDetailsAr, setBankDetailsAr] = useState('بنك الإنماء - الحساب: 68206662020000\nالأيبان: SA0305000068206662020000 عبدالمحسن\nعبدالعزيز الجبر للتجارة');

  // Closing footer message (shown in text if no footer image is uploaded).
  const [footer, setFooter] = useState('Thank you for your business!');
  const [footerAr, setFooterAr] = useState('شكرا لتعاملكم معنا!');

  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // ── UNIT SUGGESTIONS ─────────────────────────────────────────────────────────
  // These appear as auto-complete options on every Unit cell. Free-text still allowed.
  const UNIT_SUGGESTIONS = ['pc', 'set', 'lot', 'm²', 'hr', 'day', 'kg', 'm', 'lm', 'pair', 'roll'];

  // ── DRAFT AUTO-SAVE ───────────────────────────────────────────────────────────
  const DRAFT_KEY = 'quote_draft';
  const [draftBanner, setDraftBanner] = useState(false);

  // ── QUOTE TEMPLATES ───────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<{ name: string; data: any }[]>([]);

  const addCustomField = () => {
    setCustomFields([...customFields, { id: generateId(), header: 'CUSTOM FIELD:', value: '', valueAr: '' }]);
    setShowCustomField(true);
  };

  const updateCustomField = (index: number, field: keyof CustomField, val: string) => {
    const newFields = [...customFields];
    newFields[index] = { ...newFields[index], [field]: val };
    setCustomFields(newFields);
  };

  const removeCustomField = (index: number) => {
    const newFields = customFields.filter((_, i) => i !== index);
    setCustomFields(newFields);
    if (newFields.length === 0) setShowCustomField(false);
  };

  // Visibility Toggles
  const [showNote, setShowNote] = useState(true);
  const [showPayment, setShowPayment] = useState(true);
  const [showWarranty, setShowWarranty] = useState(true);
  const [showManpower, setShowManpower] = useState(true);
  const [showMobilization, setShowMobilization] = useState(true);
  const [showDuration, setShowDuration] = useState(true);
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [showCustomField, setShowCustomField] = useState(false);
  const lastFetchRef = useRef<number>(0);
  const FETCH_THROTTLE = 10000; // 10 seconds between background polls


  useEffect(() => {
    const init = async () => {
      // If we are not visible and not on the quote page, don't trigger the heavy init sequence
      if (document.visibilityState !== 'visible' && location.pathname !== '/quote') return;

      const dbCustomers = await fetchCustomers();
      const dbProducts = await fetchProducts();
      fetchLogo();
      if (user.role === 'admin' || user.permissions?.canChangeAuthor || user.permissions?.canShareQuote) {
        fetch('/api/users')
          .then(res => res.json())
          .then(data => { if (Array.isArray(data)) setUsersList(data); })
          .catch(() => {});
        fetch('/api/permission-groups')
          .then(res => res.json())
          .then(data => { if (Array.isArray(data)) setGroupsList(data.map((g: any) => ({ id: g.id, name: g.name, members: Array.isArray(g.members) ? g.members : [] }))); })
          .catch(() => {});
      }
      loadTemplates();
      if (recallQuoteId) {
        fetchQuote(recallQuoteId, dbCustomers, dbProducts);
      } else if (!quoteId) {
        // Check for saved draft
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) setDraftBanner(true);
        generateQuoteId();
        setItems(Array.from({ length: 4 }).map(() => ({ id: generateId(), description: '', description_ar: '', qty: 1, unit: 'set', unit_price: 0, net_price: 0 })));
      }
    };
    init();
  }, [recallQuoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch list of customers and products in the background when returning to the tab
  useEffect(() => {
    if (location.pathname === '/quote' && document.visibilityState === 'visible') {
      fetchCustomers();
      fetchProducts();
    }
  }, [location.pathname]);

  // Refetch lists when the browser tab gains focus (e.g. from another tab or window)
  // or via a regular background sync every 15 seconds so data is always fresh.
  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchCustomersRef.current();
        fetchProductsRef.current();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' || location.pathname === '/quote') {
        handleFocus();
      }
    }, 30000); // Increased interval to 30s to reduce load

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCustomers = async () => {
    // Don't fetch if tab is hidden and we fetched recently
    if (document.visibilityState !== 'visible' && Date.now() - lastFetchRef.current < FETCH_THROTTLE) {
      return customers;
    }

    try {
      const res = await fetch(`/api/customers?_t=${Date.now()}`);
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) {
        setCustomers(data);
        lastFetchRef.current = Date.now();
      }
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  };

  const fetchProducts = async () => {
    // Don't fetch if tab is hidden and we fetched recently
    if (document.visibilityState !== 'visible' && Date.now() - lastFetchRef.current < FETCH_THROTTLE) {
      return products;
    }

    try {
      const res = await fetch(`/api/products?_t=${Date.now()}`);
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
        lastFetchRef.current = Date.now();
      }
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  };

  // Keep a ref to always-latest fetch functions so focus/interval never get stale closures
  const fetchCustomersRef = useRef(fetchCustomers);
  const fetchProductsRef = useRef(fetchProducts);
  useEffect(() => { fetchCustomersRef.current = fetchCustomers; });
  useEffect(() => { fetchProductsRef.current = fetchProducts; });

  // Track textarea position for the fixed-position product dropdown
  useEffect(() => {
    const update = () => {
      if (focusedDescriptionIndex === null) { setDropdownPos(null); return; }
      const el = descriptionRefs.current[focusedDescriptionIndex];
      if (!el) { setDropdownPos(null); return; }
      const r = el.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width * 2, 300) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [focusedDescriptionIndex]);

  // Undo (Ctrl+Z) for dragging operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        // Prevent intercepting native text undo if typing in an input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        e.preventDefault();
        setItemsHistory(prevHistory => {
          if (prevHistory.length === 0) return prevHistory;
          const newHistory = [...prevHistory];
          const previousItems = newHistory.pop()!;
          setItems(previousItems);
          return newHistory;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── KEYBOARD SHORTCUTS ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        performSave();
      }
      // Ctrl+P to Print
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, quoteId, subject, selectedCustomerId, discount, vatRate]);

  const fetchLogo = async () => {
    try {
      const res = await fetch('/api/settings/logo');
      if (res.ok) {
        const data = await res.json();
        if (data.value) setLogoUrl(data.value);
      }
      const resSize = await fetch('/api/settings/logoSize');
      if (resSize.ok) {
        const dataSize = await resSize.json();
        if (dataSize.value) setLogoSize(parseInt(dataSize.value, 10));
      }

      const resTermsFont = await fetch('/api/settings/termsFontSize');
      if (resTermsFont.ok) {
        const dataTermsFont = await resTermsFont.json();
        if (dataTermsFont.value) setTermsFontSize(parseInt(dataTermsFont.value, 10));
      }

      const resFooter = await fetch('/api/settings/footerImage');
      if (resFooter.ok) {
        const dataFooter = await resFooter.json();
        if (dataFooter.value) setFooterImageUrl(dataFooter.value);
      }

      const resTheme = await fetch('/api/settings/themeColors');
      if (resTheme.ok) {
        const dataTheme = await resTheme.json();
        if (dataTheme.value) setThemeColors(JSON.parse(dataTheme.value));
      }

      const resMuFilters = await fetch('/api/settings/muFilters');
      if (resMuFilters.ok) {
        const dataMu = await resMuFilters.json();
        if (dataMu.value) {
          const parsed = JSON.parse(dataMu.value);
          setMuFilters({
            zeroMarkup: parsed.zeroMarkup || [],
            excluded: parsed.excluded || []
          });
        }
      }

      // Also sync developer mode from DB in case it was set on another device
      const resDevMode = await fetch('/api/settings/developerMode');
      if (resDevMode.ok) {
        const dataDevMode = await resDevMode.json();
        if (dataDevMode.value) {
          const val = dataDevMode.value === 'true';
          setDeveloperMode(val);
          localStorage.setItem('developerMode', String(val));
        }
      }

      const resRowMode = await fetch('/api/settings/rowReorderMode');
      if (resRowMode.ok) {
        const dataRowMode = await resRowMode.json();
        if (dataRowMode.value) setRowReorderMode(dataRowMode.value as 'click' | 'drag');
      }

      // Load workflow visibility (controls preparedBy, invoice, email, print, template toggles)
      const resWorkflow = await fetch('/api/settings/workflowVisibility');
      if (resWorkflow.ok) {
        const dataWorkflow = await resWorkflow.json();
        if (dataWorkflow.value) {
          const parsed = JSON.parse(dataWorkflow.value);
          setWorkflowVisibility(prev => ({ ...prev, ...parsed }));
        }
      }

      // Load stamp image
      const resStamp = await fetch('/api/settings/stampImage');
      if (resStamp.ok) {
        const dataStamp = await resStamp.json();
        if (dataStamp.value) setStampUrl(dataStamp.value);
      }

      const resStampSize = await fetch('/api/settings/stampSize');
      if (resStampSize.ok) { const d = await resStampSize.json(); if (d.value) setStampSize(parseInt(d.value, 10)); }

      const resStampOffsetX = await fetch('/api/settings/stampOffsetX');
      if (resStampOffsetX.ok) { const d = await resStampOffsetX.json(); if (d.value) setStampOffsetX(parseInt(d.value, 10)); }

      const resStampOffsetY = await fetch('/api/settings/stampOffsetY');
      if (resStampOffsetY.ok) { const d = await resStampOffsetY.json(); if (d.value) setStampOffsetY(parseInt(d.value, 10)); }
    } catch (e) {
      console.error('Failed to fetch settings', e);
    }
  };

  // ── POINTER-EVENT DRAG-AND-DROP ───────────────────────────────────────────
  // Works for both mouse and touch. Two entry points:
  //   1. Grip handle → drag starts immediately on pointerdown
  //   2. Row body    → drag starts after 600 ms long-press
  // Both use setPointerCapture so pointermove always fires on the captured
  // element; we then use elementFromPoint to find which row we hover over.

  const dragSrcRef = useRef<number | null>(null);          // row being dragged
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef({ x: 0, y: 0 });       // detect cancel-on-move

  const pointerFinalizeDrag = (targetIndex: number) => {
    const src = dragSrcRef.current;
    dragSrcRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
    if (src !== null && src !== targetIndex) {
      setItems(prev => {
        // Save current items to history before mutating (keep last 20)
        setItemsHistory(h => [...h, prev].slice(-20));

        const next = [...prev];
        const [moved] = next.splice(src, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    }
  };

  const pointerCancelDrag = () => {
    dragSrcRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Shared pointermove handler once dragging is active (called on captured element)
  const onDragPointerMove = (e: React.PointerEvent) => {
    if (dragSrcRef.current === null) return;
    // Temporarily release capture so elementFromPoint can see other elements
    const el = e.currentTarget as HTMLElement;
    el.releasePointerCapture(e.pointerId);
    const target = document.elementFromPoint(e.clientX, e.clientY);
    el.setPointerCapture(e.pointerId);
    const rowEl = target?.closest('[data-row-index]') as HTMLElement | null;
    if (rowEl) {
      const idx = parseInt(rowEl.dataset.rowIndex ?? '-1');
      if (idx >= 0) setDragOverIndex(idx);
    }
  };

  // ── GRIP HANDLE pointer handlers (immediate drag) ──────────────────────────
  const onGripPointerDown = (e: React.PointerEvent, index: number) => {
    if (rowReorderMode !== 'drag') return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragSrcRef.current = index;
    setDragIndex(index);
  };

  const onGripPointerMove = (e: React.PointerEvent) => {
    onDragPointerMove(e);
  };

  const onGripPointerUp = (e: React.PointerEvent) => {
    if (dragSrcRef.current === null) return;
    const el = e.currentTarget as HTMLElement;
    el.releasePointerCapture(e.pointerId);
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const rowEl = target?.closest('[data-row-index]') as HTMLElement | null;
    const targetIdx = rowEl ? parseInt(rowEl.dataset.rowIndex ?? '-1') : -1;
    pointerFinalizeDrag(targetIdx >= 0 ? targetIdx : dragSrcRef.current ?? 0);
  };

  // ── ROW BODY pointer handlers (long-press drag) ────────────────────────────
  const onRowBodyPointerDown = (e: React.PointerEvent, index: number) => {
    if (rowReorderMode !== 'drag') return;
    if ((e.target as HTMLElement).closest('.product-dropdown')) return;
    const tag = (e.target as HTMLElement).tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'LABEL', 'TH'].includes(tag)) return;
    longPressStartRef.current = { x: e.clientX, y: e.clientY };
    const el = e.currentTarget as HTMLElement;

    // Start drag instantly (matches Tracking method)
    el.setPointerCapture(e.pointerId);
    dragSrcRef.current = index;
    setDragIndex(index);
    navigator.vibrate?.(50);
  };

  const onRowBodyPointerMove = (e: React.PointerEvent) => {
    if (dragSrcRef.current !== null) {
      // Drag is active — track hover target
      onDragPointerMove(e);
    }
  };

  const onRowBodyPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (dragSrcRef.current === null) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const rowEl = target?.closest('[data-row-index]') as HTMLElement | null;
    const targetIdx = rowEl ? parseInt(rowEl.dataset.rowIndex ?? '-1') : -1;
    pointerFinalizeDrag(targetIdx >= 0 ? targetIdx : dragSrcRef.current ?? 0);
  };

  const handleAutoTranslate = async (text: string, currentAr: string, setterAr: (val: string) => void, force = true) => {
    if (!text) return;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation) setterAr(data.translation);
      }
    } catch (e) {
      console.error('Translation failed', e);
    }
  };

  const translateSingle = async (text: string): Promise<string | null> => {
    if (!text) return null;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        return data.translation || null;
      }
    } catch (e) {
      console.error('Translation helper failed', e);
    }
    return null;
  };

  const handleTranslateAll = async () => {
    const isConfirm = confirm('This will force translate ALL Arabic fields based on current English content. Proceed?');
    if (!isConfirm) return;

    // 1. Subject
    if (subject) {
      const trans = await translateSingle(subject);
      if (trans) setSubjectAr(trans);
    }

    // 2. Items
    const newItems = [...items];
    let itemsChanged = false;
    for (let i = 0; i < newItems.length; i++) {
      if (newItems[i].description) {
        const trans = await translateSingle(newItems[i].description);
        if (trans) {
          newItems[i].description_ar = trans;
          itemsChanged = true;
        }
      }
    }
    if (itemsChanged) setItems(newItems);

    // 3. Terms
    if (note) {
      const trans = await translateSingle(note);
      if (trans) setNoteAr(trans);
    }
    if (payment) {
      const trans = await translateSingle(payment);
      if (trans) setPaymentAr(trans);
    }
    if (warranty) {
      const trans = await translateSingle(warranty);
      if (trans) setWarrantyAr(trans);
    }
    if (manpower) {
      const trans = await translateSingle(manpower);
      if (trans) setManpowerAr(trans);
    }
    if (mobilization) {
      const trans = await translateSingle(mobilization);
      if (trans) setMobilizationAr(trans);
    }
    if (duration) {
      const trans = await translateSingle(duration);
      if (trans) setDurationAr(trans);
    }
    if (bankDetails) {
      const trans = await translateSingle(bankDetails);
      if (trans) setBankDetailsAr(trans);
    }

    // 4. Custom Fields
    const newCFs = [...customFields];
    let cfChanged = false;
    for (let i = 0; i < newCFs.length; i++) {
      if (newCFs[i].value) {
        const trans = await translateSingle(newCFs[i].value);
        if (trans) {
          newCFs[i].valueAr = trans;
          cfChanged = true;
        }
      }
    }
    if (cfChanged) setCustomFields(newCFs);

    alert('Translation process complete!');
  };

  const handleProductAutoTranslate = async (index: number, text: string, currentAr: string, force = true) => {
    if (!text) return;
    // Mark row as translating
    setTranslatingRows(prev => { const s = new Set(prev); s.add(index); return s; });
    const clearIndicator = () => setTranslatingRows(prev => { const s = new Set(prev); s.delete(index); return s; });
    const attempt = async (tries = 0): Promise<void> => {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.translation) {
            updateItem(index, 'description_ar', data.translation);
          } else if (tries < 2) {
            // Empty result — retry once after a short delay
            await new Promise(r => setTimeout(r, 700));
            return attempt(tries + 1);
          }
        } else if (tries < 2) {
          await new Promise(r => setTimeout(r, 700));
          return attempt(tries + 1);
        }
      } catch (e) {
        if (tries < 2) {
          await new Promise(r => setTimeout(r, 700));
          return attempt(tries + 1);
        }
        console.error('Translation failed', e);
      }
    };
    await attempt();
    clearIndicator();
  };


  // Auto-translate Debounced Effect for Notes
  useEffect(() => {
    if (note === lastNoteTrigger) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: note })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.translation) setNoteAr(data.translation);
          setLastNoteTrigger(note);
        }
      } catch (e) {
        console.error('Notes translation failed', e);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [note, lastNoteTrigger]);

  const fetchQuote = async (id: string, customersList: Customer[] = customers, productsList: Product[] = products) => {
    const res = await fetch(`/api/quotes/${id}`);
    if (res.ok) {
      const data = await res.json();

      let parsedDraft: any = null;
      if (data.draft_data) {
        try {
          parsedDraft = typeof data.draft_data === 'string' ? JSON.parse(data.draft_data) : data.draft_data;
        } catch (e) { }
      }

      setQuoteId(data.quote_id);
      setDate(parsedDraft?.date || data.date);
      setExpiryDate(parsedDraft?.expiryDate || data.expiry_date || '');
      setSelectedCustomerId(parsedDraft?.selectedCustomerId || data.customer_id || '');

      // Update search field if customer found
      const custId = parsedDraft?.selectedCustomerId || data.customer_id;
      const c = customersList.find(cust => cust.id === custId);
      if (c) {
        setSelectedCustomer(c);
        setCustomerSearch(c.name);
      }

      setSubject(parsedDraft?.subject || data.subject || '');
      setSubjectAr(parsedDraft?.subjectAr || data.subject_ar || '');
      setNoteHeader(parsedDraft?.noteHeader || data.note_header || 'NOTE:');
      setNote(parsedDraft?.note || data.note || 'Any additional work|device will be considered Change Order\nInternet source is provided by the OWNER');
      setNoteAr(parsedDraft?.noteAr || data.note_ar || 'سيتم اعتبار أي عمل إضافي | جهاز بمثابة أمر تغيير\nيتم توفير مصدر الإنترنت من قبل المالك');
      setDiscount(parsedDraft?.discount !== undefined ? parsedDraft.discount : (data.discount || 0));
      setStatus(data.status || 'Draft');
      setType(data.type || 'Quotation');
      setVersion(data.version || 1);
      setVatRate(parsedDraft?.vatRate !== undefined ? parsedDraft.vatRate : (data.vat_rate !== undefined ? data.vat_rate : 15));
      setMarkup(parsedDraft?.markup !== undefined ? parsedDraft.markup : (data.markup !== undefined ? data.markup : 8));
      setPayment(parsedDraft?.payment || data.payment || 'Full Payment in ADVANCE');
      setPaymentAr(parsedDraft?.paymentAr || data.payment_ar || 'الدفع الكامل مقدما');
      setWarranty(parsedDraft?.warranty || data.warranty || "2 YEARS limited warranty and/or supplier's recommendation");
      setWarrantyAr(parsedDraft?.warrantyAr || data.warranty_ar || 'ضمان محدود لمدة عامين و/أو توصية المورد');
      setManpower(parsedDraft?.manpower || data.manpower || '2 Technicians, 1 Supervisor');
      setManpowerAr(parsedDraft?.manpowerAr || data.manpower_ar || 'فنيين، 1 مشرف 2');
      setMobilization(parsedDraft?.mobilization || data.mobilization || '3-4 days upon confirmation of payment');
      setMobilizationAr(parsedDraft?.mobilizationAr || data.mobilization_ar || 'أيام بعد تأكيد الدفع 4-3');
      setDuration(parsedDraft?.duration || data.duration || '1-2 Working Days');
      setDurationAr(parsedDraft?.durationAr || data.duration_ar || 'أيام عمل 2-1');
      setBankDetails(parsedDraft?.bankDetails || data.bank_details || 'ALINMA BANK - Account: 68206662020000\nIBAN: SA0305000068206662020000 ABDULMOSHIN\nABDULAZIZ AL-JABR TRADING CO.');
      setBankDetailsAr(parsedDraft?.bankDetailsAr || data.bank_details_ar || 'بنك الإنماء - الحساب: 68206662020000\nالأيبان: SA0305000068206662020000 عبدالمحسن\nعبدالعزيز الجبر للتجارة');
      setFooter(parsedDraft?.footer || data.footer || 'Thank you for your business!');
      setFooterAr(parsedDraft?.footerAr || data.footer_ar || 'شكرا لتعاملكم معنا!');

      let parsedCustomFields: CustomField[] = [];
      const cfSource = parsedDraft?.customFields ? JSON.stringify(parsedDraft.customFields) : data.custom_field;
      if (cfSource) {
        try {
          const parsed = JSON.parse(cfSource);
          if (Array.isArray(parsed)) {
            parsedCustomFields = parsed;
          } else {
            parsedCustomFields = [{
              id: generateId(),
              header: data.custom_field_header || 'CUSTOM FIELD:',
              value: data.custom_field || '',
              valueAr: data.custom_field_ar || ''
            }];
          }
        } catch (e) {
          parsedCustomFields = [{
            id: generateId(),
            header: data.custom_field_header || 'CUSTOM FIELD:',
            value: data.custom_field || '',
            valueAr: data.custom_field_ar || ''
          }];
        }
      }
      setCustomFields(parsedCustomFields);
      setShowCustomField(parsedCustomFields.length > 0);

      setAuthorName(data.author_name || data.author_username || '');
      setAuthorId(data.author_id || null);
      try {
        const sw = typeof data.shared_with === 'string' ? JSON.parse(data.shared_with || '{}') : (data.shared_with || {});
        setSharedWith({
          users: Array.isArray(sw.users) ? sw.users : [],
          groups: Array.isArray(sw.groups) ? sw.groups : [],
          canEditUsers: Array.isArray(sw.canEditUsers) ? sw.canEditUsers : [],
          canEditGroups: Array.isArray(sw.canEditGroups) ? sw.canEditGroups : [],
        });
      } catch { setSharedWith({ users: [], groups: [], canEditUsers: [], canEditGroups: [] }); }

      let increases = 0;
      let decreases = 0;

      let itemsToProcess = data.items || [];
      if (parsedDraft && parsedDraft.items && parsedDraft.items.length > 0) {
        itemsToProcess = parsedDraft.items;
      }

      if (itemsToProcess.length === 0) {
        itemsToProcess = Array.from({ length: 4 }).map(() => ({ id: generateId(), description: '', description_ar: '', qty: 1, unit: 'set', unit_price: 0, net_price: 0 }));
      }

      setItems(itemsToProcess.map((item: any) => {
        let original_price = item.original_price;
        let manual_price = item.manual_price !== null && item.manual_price !== undefined ? item.manual_price : undefined;

        let costShift: 'up' | 'down' | undefined = undefined;

        if (item.product_id) {
          const prod = productsList.find(p => p.id === item.product_id);
          if (prod) {
            const dbPrice = prod.unit_price;
            if (original_price !== dbPrice && original_price !== undefined) {
              if (dbPrice > original_price) {
                increases++;
                costShift = 'up';
              } else {
                decreases++;
                costShift = 'down';
              }

              original_price = dbPrice;
              const currentMarkup = parsedDraft?.markup !== undefined ? parsedDraft.markup : (data.markup !== undefined ? data.markup : 8);
              const expectedNewUnitPrice = dbPrice * (1 + currentMarkup / 100);
              const currentUnitPrice = item.unit_price;
              if (manual_price === undefined && Math.abs(currentUnitPrice - expectedNewUnitPrice) > 0.01) {
                manual_price = Math.round(currentUnitPrice * 100) / 100;
              }
            }
          }
        }

        // Round manual price if it exists
        if (manual_price !== undefined) {
          manual_price = Math.round(manual_price * 100) / 100;
        }

        // Determine current unit price
        let unit_price = item.unit_price || 0;
        if (manual_price !== undefined) {
          unit_price = manual_price;
        } else if (original_price !== undefined) {
          const currentMarkup = parsedDraft?.markup !== undefined ? parsedDraft.markup : (data.markup || 8);
          unit_price = Math.round(original_price * (1 + currentMarkup / 100) * 100) / 100;
        }

        return {
          ...item,
          id: item.id || generateId(),
          original_price: original_price !== null ? original_price : undefined,
          manual_price: manual_price,
          unit_price: unit_price,
          net_price: Math.round(unit_price * (item.qty || 1) * 100) / 100,
          internal_note: item.internal_note || '',
          costShift
        };
      }));

      if (increases > 0 || decreases > 0) {
        let type: 'increase' | 'decrease' | 'mixed' = 'mixed';
        if (increases > 0 && decreases === 0) type = 'increase';
        if (decreases > 0 && increases === 0) type = 'decrease';
        setPriceAlert({ type, count: increases + decreases });
      }
    }
  };

  const generateQuoteId = async () => {
    try {
      const res = await fetch('/api/quotes/next-id');
      if (res.ok) {
        const data = await res.json();
        setQuoteId(data.nextId);
      } else {
        // Fallback
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        setQuoteId(`AJ-${randomNum}`);
      }
    } catch (e) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      setQuoteId(`AJ-${randomNum}`);
    }
  };

  const clearForm = () => {
    if (!confirm('Quote Form will be cleaned up. Do you confirm?')) return;
    generateQuoteId();
    setSearchParams({});
    setDate(new Date().toISOString().split('T')[0]);
    setExpiryDate('');
    localStorage.removeItem('quote_draft');
    setSelectedCustomerId('');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setSubject('');
    setSubjectAr('');
    setNoteHeader('NOTE:');
    setDiscount(0);
    setStatus('Draft');
    setType('Quotation');
    setVatRate(15);
    setNote('Any additional work|device will be considered Change Order\nInternet source is provided by the OWNER');
    setNoteAr('سيتم اعتبار أي عمل إضافي | جهاز بمثابة أمر تغيير\nيتم توفير مصدر الإنترنت من قبل المالك');
    setPayment('Full Payment in ADVANCE');
    setPaymentAr('الدفع الكامل مقدما');
    setWarranty("2 YEARS limited warranty and/or supplier's recommendation");
    setWarrantyAr('ضمان محدود لمدة عامين و/أو توصية المورد');
    setManpower('2 Technicians, 1 Supervisor');
    setManpowerAr('فنيين، 1 مشرف 2');
    setMobilization('3-4 days upon confirmation of payment');
    setMobilizationAr('أيام بعد تأكيد الدفع 4-3');
    setDuration('1-2 Working Days');
    setDurationAr('أيام عمل 2-1');
    setBankDetails('ALINMA BANK - Account: 68206662020000\nIBAN: SA0305000068206662020000 ABDULMOSHIN\nABDULAZIZ AL-JABR TRADING CO.');
    setBankDetailsAr('');
    setFooter('Thank you for your business!');
    setFooterAr('شكرا لتعاملكم معنا!');
    setAuthorName(user.name || user.username);
    setAuthorId(null);
    setSharedWith({ users: [], groups: [], canEditUsers: [], canEditGroups: [] });
    setItems(Array.from({ length: 4 }).map(() => ({ id: generateId(), description: '', description_ar: '', qty: 1, unit: 'set', unit_price: 0, net_price: 0 })));
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === parseInt(productId));
    if (product) {
      setItems(prevItems => {
        const newItems = [...prevItems];
        const newUnitPrice = product.unit_price * (1 + markup / 100);
        newItems[index] = {
          ...newItems[index],
          product_id: product.id,
          original_price: product.unit_price,
          description: product.description,
          description_ar: product.description_ar || '',
          unit: product.unit,
          unit_price: newUnitPrice,
          manual_price: undefined,
          net_price: newItems[index].qty * newUnitPrice
        };
        return newItems;
      });
      // Force auto-translate since we picked a known product without an arabic description yet
      handleProductAutoTranslate(index, product.description, product.description_ar || '');
    }
  };

  const handleRfqUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRfqLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/rfq/parse', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Ensure we hit the API properly
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const mappedItems: QuoteItem[] = data.items.map((it: any) => ({
            id: generateId(),
            description: it.description,
            description_ar: '', // Will let user auto-translate it later
            qty: it.qty || 1,
            unit: it.unit || 'set',
            unit_price: 0,
            net_price: 0
          }));

          setItems(prev => {
            const temp = prev.filter(p => p.description.trim() !== '');
            return [...temp, ...mappedItems];
          });
          alert('RFQ Parsed successfully! Prices are set to 0. Please verify descriptions.');
        } else {
          alert('AI did not find any items or returned an invalid format.');
        }
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsRfqLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], [field]: value };

      if (field === 'manual_price') {
        if (value !== undefined && value !== null && value !== '' && !isNaN(value)) {
          newItems[index].unit_price = Math.round(value * 100) / 100;
          newItems[index].manual_price = Math.round(value * 100) / 100;
        } else {
          const orig = newItems[index].original_price;
          newItems[index].unit_price = orig !== undefined ? Math.round(orig * (1 + markup / 100) * 100) / 100 : 0;
          newItems[index].manual_price = undefined;
        }
      } else if (field === 'unit_price') {
        newItems[index].manual_price = value === '' || isNaN(value) ? undefined : Math.round(value * 100) / 100;
      }

      if (field === 'qty' || field === 'unit_price' || field === 'manual_price') {
        newItems[index].net_price = Math.round(newItems[index].qty * newItems[index].unit_price * 100) / 100;
      }
      return newItems;
    });
  };

  const addItem = () => {
    setItems([...items, { id: generateId(), description: '', description_ar: '', qty: 1, unit: 'set', unit_price: 0, net_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (!window.confirm('Are you sure you want to remove this item?')) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems.length ? newItems : [{ id: generateId(), description: '', description_ar: '', qty: 1, unit: 'set', unit_price: 0, net_price: 0 }]);
  };

  const moveItemUp = (index: number) => {
    if (index === 0) return;
    setItems(prevItems => {
      const newItems = [...prevItems];
      const temp = newItems[index - 1];
      newItems[index - 1] = newItems[index];
      newItems[index] = temp;
      return newItems;
    });
  };

  const moveItemDown = (index: number) => {
    if (index === items.length - 1) return;
    setItems(prevItems => {
      const newItems = [...prevItems];
      const temp = newItems[index + 1];
      newItems[index + 1] = newItems[index];
      newItems[index] = temp;
      return newItems;
    });
  };

  // ── ADVANCED MU CALCULATION ───────────────────────────────────────────────
  const getItemRule = (item: QuoteItem) => {
    const desc = (item.description || '').toLowerCase();
    if (muFilters.excluded.some(kw => desc.includes(kw.toLowerCase()))) return 'EXCL';
    if (muFilters.zeroMarkup.some(kw => desc.includes(kw.toLowerCase()))) return 'ZM';

    const hasManual = item.manual_price !== undefined && item.manual_price !== null;
    const hasDB = item.original_price !== undefined && item.original_price !== null;
    // User requested: only overwrite base price if it contains 'materials'
    const isSpecial = desc.includes('materials');

    if (hasManual) {
      // Use manual price as the BASE calculation if it's special OR if no DB price exists to fall back on
      if (isSpecial || !hasDB) {
        return 'MAN';
      }
    }

    if (hasDB) return 'DB';
    return '--';
  };

  const subtotal = items.reduce((sum, item) => sum + (item.net_price || 0), 0);

  let baseTotal = 0;
  let markupProfit = 0;

  items.forEach(item => {
    const rule = getItemRule(item);
    const saleTotal = item.net_price || 0;

    if (rule === 'EXCL') {
      // Excluded: contributes nothing to base cost and nothing to profit
    } else if (rule === 'ZM') {
      // Zero markup: base cost equals sale price, so 0 profit
      baseTotal += saleTotal;
    } else {
      let itemBaseUnit = 0;
      if (rule === 'MAN') itemBaseUnit = item.manual_price!;
      else if (rule === 'DB') itemBaseUnit = item.original_price!;

      const itemBaseTotal = itemBaseUnit * item.qty;
      baseTotal += itemBaseTotal;
      markupProfit += (saleTotal - itemBaseTotal);
    }
  });
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = discountedSubtotal * (vatRate / 100);
  const grandTotal = discountedSubtotal + tax;

  const performSave = async (force: boolean = false) => {
    const payload = {
      quote_id: quoteId,
      date,
      expiry_date: expiryDate || null,
      customer_id: selectedCustomerId,
      subject,
      subject_ar: subjectAr,
      discount,
      subtotal,
      tax,
      grand_total: grandTotal,
      note_header: noteHeader,
      note,
      note_ar: noteAr,
      payment,
      payment_ar: paymentAr,
      warranty,
      warranty_ar: warrantyAr,
      manpower,
      manpower_ar: manpowerAr,
      mobilization,
      mobilization_ar: mobilizationAr,
      duration,
      duration_ar: durationAr,
      bank_details: bankDetails,
      bank_details_ar: bankDetailsAr,
      footer,
      footer_ar: footerAr,
      custom_field_header: '',
      custom_field: JSON.stringify(customFields),
      custom_field_ar: '',
      status,
      type,
      vat_rate: vatRate,
      markup: markup,
      author_name: authorName,
      author_id: authorId,
      shared_with: sharedWith,
      items: items.filter(item => item.description.trim() !== '').map(item => ({
        product_id: item.product_id,
        description: item.description,
        description_ar: item.description_ar,
        qty: item.qty,
        unit: item.unit,
        unit_price: item.unit_price,
        net_price: item.net_price,
        original_price: item.original_price, // Added base price tracking
        manual_price: item.manual_price      // Added manual price tracking
      })),
      version,
      force
    };

    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      setVersion(data.version || 1); // Update local version lock to the newly saved version
      alert(recallQuoteId === quoteId ? 'Quote updated successfully!' : 'Quote data is recorded to Tracking section!');
      localStorage.removeItem('quote_draft'); // clear local draft just in case
      setShowOverwriteModal(false);
      setShowConflictModal(false);
    } else if (res.status === 409) {
      const errorData = await res.json();
      if (errorData.error === 'ID_TAKEN') {
        alert("This Quote ID was just used by someone else! Generating a new one for you automatically...");
        handleCreateNewId();
      } else {
        setShowConflictModal(true);
      }
    } else {
      const error = await res.json();
      alert(`Failed to record quote: ${error.error}`);
    }
  };

  const recordQuote = async () => {
    if (!quoteId) return alert('Please enter Quote ID!');
    if (!date) return alert('Please input date!');
    if (grandTotal === 0) return alert('Total is zero! Please check.');
    if (!selectedCustomerId) return alert('Please select a customer.');

    try {
      // Check if quote ID already exists
      const checkRes = await fetch(`/api/quotes/${quoteId}`);
      if (checkRes.ok) {
        // Quote exists. If we are not explicitly editing this specific quote, warn them.
        if (recallQuoteId !== quoteId) {
          setShowOverwriteModal(true);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not check for existing quote', e);
    }

    await performSave();
  };

  const handleCreateNewId = async () => {
    setShowOverwriteModal(false);
    await generateQuoteId();
    // Use setTimeout so the new ID state applies before telling user to save again.
    setTimeout(() => {
      alert("A new Quote ID has been generated! You can now click Record to save.");
    }, 100);
  };

  // ── DRAFT AUTO-SAVE: write every 30 seconds to the DB ─────────────────────
  useEffect(() => {
    // Only autosave to LocalStorage if we have meaningful work to protect, 
    // or if we are already in the middle of a session.
    // This prevents a NEW blank form from overwriting an OLD draft from a previous session.
    const isMeaningful = subject.trim() !== '' ||
      selectedCustomerId !== '' ||
      items.some(i => i.description.trim() !== '');

    if (isMeaningful) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        quoteId, date, expiryDate, subject, subjectAr, items, discount, vatRate, markup, authorName, authorId,
        selectedCustomerId, selectedCustomer, customerSearch,
        note, noteAr, noteHeader, payment, paymentAr, warranty, warrantyAr,
        manpower, manpowerAr, mobilization, mobilizationAr, duration, durationAr,
        bankDetails, bankDetailsAr, footer, footerAr, customFields,
        savedAt: new Date().toISOString(),
      }));
    }

    const save = async () => {
      // Only autosave to DB if the tab is active and data is meaningful
      if (document.visibilityState !== 'visible' || !isMeaningful) return;

      const draft = {
        quoteId, date, expiryDate, subject, subjectAr, items, discount, vatRate, markup, authorName, authorId,
        selectedCustomerId, selectedCustomer, customerSearch,
        note, noteAr, noteHeader, payment, paymentAr, warranty, warrantyAr,
        manpower, manpowerAr, mobilization, mobilizationAr, duration, durationAr,
        bankDetails, bankDetailsAr, footer, footerAr, customFields,
        savedAt: new Date().toISOString(),
      };

      try {
        if (!quoteId) return; // Cannot save to DB without an ID

        await fetch('/api/quotes/autosave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quote_id: quoteId,
            draft_data: draft,
            grand_total: grandTotal
          })
        });
      } catch (e) {
        console.warn('Autosave failed:', e);
      }
    };

    const timer = setInterval(save, 30000);
    return () => clearInterval(timer);
  }, [quoteId, date, expiryDate, subject, subjectAr, items, discount, vatRate,
    note, noteAr, noteHeader, payment, paymentAr, warranty, warrantyAr,
    manpower, manpowerAr, mobilization, mobilizationAr, duration, durationAr,
    bankDetails, bankDetailsAr, footer, footerAr, customFields, recallQuoteId,
    selectedCustomerId, selectedCustomer, customerSearch]);

  const restoreDraft = () => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      if (d.quoteId) setQuoteId(d.quoteId);
      if (d.date) setDate(d.date);
      if (d.expiryDate) setExpiryDate(d.expiryDate);
      if (d.subject) setSubject(d.subject);
      if (d.subjectAr) setSubjectAr(d.subjectAr);
      if (d.selectedCustomerId !== undefined) setSelectedCustomerId(d.selectedCustomerId);
      if (d.selectedCustomer !== undefined) setSelectedCustomer(d.selectedCustomer);
      if (d.customerSearch !== undefined) setCustomerSearch(d.customerSearch);
      if (d.items?.length) setItems(d.items);
      if (d.discount) setDiscount(d.discount);
      if (d.vatRate !== undefined) setVatRate(d.vatRate);
      if (d.markup !== undefined) setMarkup(d.markup);
      if (d.authorName !== undefined) setAuthorName(d.authorName);
      if (d.authorId !== undefined) setAuthorId(d.authorId);
      if (d.note) setNote(d.note);
      if (d.noteAr) setNoteAr(d.noteAr);
      if (d.noteHeader) setNoteHeader(d.noteHeader);
      if (d.payment) setPayment(d.payment);
      if (d.paymentAr) setPaymentAr(d.paymentAr);
      if (d.warranty) setWarranty(d.warranty);
      if (d.warrantyAr) setWarrantyAr(d.warrantyAr);
      if (d.manpower) setManpower(d.manpower);
      if (d.manpowerAr) setManpowerAr(d.manpowerAr);
      if (d.mobilization) setMobilization(d.mobilization);
      if (d.mobilizationAr) setMobilizationAr(d.mobilizationAr);
      if (d.duration) setDuration(d.duration);
      if (d.durationAr) setDurationAr(d.durationAr);
      if (d.bankDetails) setBankDetails(d.bankDetails);
      if (d.bankDetailsAr) setBankDetailsAr(d.bankDetailsAr);
      if (d.footer) setFooter(d.footer);
      if (d.footerAr) setFooterAr(d.footerAr);
      if (d.customFields) setCustomFields(d.customFields);
    } catch (e) { /* ignore */ }
    setDraftBanner(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftBanner(false);
  };

  // ── TEMPLATES ─────────────────────────────────────────────────────────────────
  const loadTemplates = () => {
    try {
      const raw = localStorage.getItem('quote_templates');
      if (raw) setTemplates(JSON.parse(raw));
    } catch (e) { /* ignore */ }
  };

  const saveTemplate = () => {
    if (!templateName.trim()) return alert('Please enter a template name.');
    const data = {
      note, noteAr, noteHeader, payment, paymentAr, warranty, warrantyAr,
      manpower, manpowerAr, mobilization, mobilizationAr, duration, durationAr,
      bankDetails, bankDetailsAr, footer, footerAr, vatRate,
    };
    const newTemplates = [...templates.filter(t => t.name !== templateName.trim()), { name: templateName.trim(), data }];
    localStorage.setItem('quote_templates', JSON.stringify(newTemplates));
    setTemplates(newTemplates);
    setShowTemplateModal(false);
    setTemplateName('');
    alert(`Template "${templateName.trim()}" saved!`);
  };

  const deleteTemplate = (name: string) => {
    if (!confirm(`Are you sure you want to delete the template "${name}"?`)) return;
    const newTemplates = templates.filter(t => t.name !== name);
    localStorage.setItem('quote_templates', JSON.stringify(newTemplates));
    setTemplates(newTemplates);
  };

  const applyTemplate = (t: { name: string; data: any }) => {
    const d = t.data;
    if (d.note !== undefined) setNote(d.note);
    if (d.noteAr !== undefined) setNoteAr(d.noteAr);
    if (d.noteHeader !== undefined) setNoteHeader(d.noteHeader);
    if (d.payment !== undefined) setPayment(d.payment);
    if (d.paymentAr !== undefined) setPaymentAr(d.paymentAr);
    if (d.warranty !== undefined) setWarranty(d.warranty);
    if (d.warrantyAr !== undefined) setWarrantyAr(d.warrantyAr);
    if (d.manpower !== undefined) setManpower(d.manpower);
    if (d.manpowerAr !== undefined) setManpowerAr(d.manpowerAr);
    if (d.mobilization !== undefined) setMobilization(d.mobilization);
    if (d.mobilizationAr !== undefined) setMobilizationAr(d.mobilizationAr);
    if (d.duration !== undefined) setDuration(d.duration);
    if (d.durationAr !== undefined) setDurationAr(d.durationAr);
    if (d.bankDetails !== undefined) setBankDetails(d.bankDetails);
    if (d.bankDetailsAr !== undefined) setBankDetailsAr(d.bankDetailsAr);
    if (d.footer !== undefined) setFooter(d.footer);
    if (d.footerAr !== undefined) setFooterAr(d.footerAr);
    if (d.vatRate !== undefined) setVatRate(d.vatRate);
  };

  // ── DUPLICATE QUOTE ───────────────────────────────────────────────────────────
  const handleDuplicate = async () => {
    if (!confirm('This will copy the current quote into a new ID. Proceed?')) return;
    await generateQuoteId();
    // Clear the recall param so it saves as a new quote
    setSearchParams({});
    alert('Quote duplicated with a new ID. Click Record to save it.');
  };

  const handleCreateRevision = () => {
    // Basic logic to append or increment -R suffix
    const currentId = quoteId.trim();
    if (!currentId) return;

    let newId = currentId;
    const revMatch = currentId.match(/-R(\d+)$/);
    if (revMatch) {
      const nextRev = parseInt(revMatch[1], 10) + 1;
      newId = currentId.replace(/-R\d+$/, `-R${nextRev}`);
    } else {
      newId = `${currentId}-R1`;
    }

    setQuoteId(newId);
    setStatus('Draft');
    setType('Quotation');
    alert(`Revision created as ${newId}. You can now make changes and hit Record.`);
  };

  const handleConvertToInvoice = () => {
    setType('Tax Invoice');
    setStatus('Draft');
    alert('Document converted to Tax Invoice! Remember to Record the document to save changes.');
  };

  const handleSendEmail = async () => {
    if (!recallQuoteId) {
      alert('You must Record this quote before you can email it.');
      return;
    }

    const to = prompt("Enter the recipient's email address:");
    if (!to) return;

    const body = prompt("Enter a brief message for the email body:");
    if (body === null) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: `${type} - ${subject || quoteId}`,
          body: body || 'Please find the attached document.',
          pdfHtml: '' // For complete system, generate PDF blob and send base64 here
        })
      });

      if (res.ok) {
        setStatus('Sent');
        alert('Email sent successfully via SMTP!');
      } else {
        const error = await res.json();
        alert(`Failed to send email: ${error.error}`);
      }
    } catch (err) {
      alert('Error connecting to email service.');
    } finally {
      setIsSending(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ── PDF EXPORT ────────────────────────────────────────────────────────────
  // Uses html2canvas to take a screenshot of the quote and then embeds it into
  // a jsPDF document at A4 size.
  //
  // QUALITY / FILE SIZE:
  //   • scale: 2          → Higher = sharper at the cost of larger file. Try 3 for
  //                          very crisp output, or 1 for faster/smaller files.
  //   • 'JPEG', 0.8       → JPEG quality (0.0–1.0). 0.8 = 80% quality (good balance).
  //                          Change to 1.0 for maximum quality or 'PNG' for lossless.
  const handleExportPDF = async () => {
    if (!printRef.current) return;

    try {
      // Store original values and styles to use in onclone
      const originalElements = printRef.current.querySelectorAll('input, textarea, select');
      const elementData = Array.from(originalElements).map((el: any) => {
        const computedStyle = window.getComputedStyle(el);
        // Use the exact computed font size — no scaling — so replaced divs
        // match surrounding static text exactly in the PDF.
        return {
          value: el.tagName === 'SELECT' ? el.options[el.selectedIndex]?.text : el.value,
          textAlign: computedStyle.textAlign,
          fontFamily: computedStyle.fontFamily,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          color: computedStyle.color,
          padding: computedStyle.padding,
        };
      });

      const canvas = await html2canvas(printRef.current, {
        // ── CHANGE PDF RESOLUTION HERE ────────────────────────────────────
        // scale: 2 means the canvas renders at 2× the screen resolution.
        // Increase to 3 or 4 for sharper print, decrease to 1 for speed.
        scale: 3,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const clonedElements = clonedDoc.querySelectorAll('input, textarea, select');
          clonedElements.forEach((el: any, index) => {
            const data = elementData[index];
            if (!data) return;

            const div = clonedDoc.createElement('div');
            div.innerText = data.value || '';
            div.className = el.className;
            div.style.textAlign = data.textAlign;
            div.style.fontFamily = data.fontFamily;
            div.style.fontSize = data.fontSize;
            div.style.fontWeight = data.fontWeight;
            div.style.color = data.color;
            div.style.padding = data.padding;
            div.style.whiteSpace = 'pre-wrap';
            div.style.wordBreak = 'break-word';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            if (data.textAlign === 'right') div.style.justifyContent = 'flex-end';
            if (data.textAlign === 'center') div.style.justifyContent = 'center';

            if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) {
              div.style.minHeight = el.offsetHeight ? `${el.offsetHeight}px` : (el.style.height || 'auto');
              div.style.height = 'auto';
              div.style.overflow = 'visible';
              div.style.alignItems = el.tagName === 'TEXTAREA' ? 'flex-start' : 'center';
              div.style.whiteSpace = 'pre-wrap';
              div.style.wordBreak = 'break-word';
            }

            div.style.border = 'none';
            div.style.background = 'transparent';

            el.parentNode?.replaceChild(div, el);
          });

          // Hide elements that should not be printed
          const hiddenElements = clonedDoc.querySelectorAll('.print\\:hidden');
          hiddenElements.forEach((el: any) => {
            el.style.display = 'none';
          });

          // Show elements that are print-only
          const printBlockElements = clonedDoc.querySelectorAll('.print\\:block, .print\\:flex');
          printBlockElements.forEach((el: any) => {
            el.style.display = el.classList.contains('print:flex') ? 'flex' : 'block';
          });

          // Apply specific print styles to avoid borders and bg colors in PDF
          clonedDoc.querySelectorAll('.print\\:border-none').forEach((el: any) => {
            el.style.border = 'none';
          });
          clonedDoc.querySelectorAll('.print\\:bg-transparent').forEach((el: any) => {
            el.style.backgroundColor = 'transparent';
          });

          clonedDoc.querySelectorAll('.print\\:p-0').forEach((el: any) => {
            if (!el.dataset.pdfRoot) el.style.padding = '0';
          });

          clonedDoc.querySelectorAll('.min-w-\\[1200px\\]').forEach((el: any) => {
            el.classList.remove('min-w-[1200px]');
            el.style.minWidth = '0';
          });

          clonedDoc.querySelectorAll('.print\\:overflow-visible').forEach((el: any) => {
            el.style.overflow = 'visible';
          });

          // ★ CENTER THE TABLE IN THE PDF ★
          const tableOverflowContainer = clonedDoc.querySelector('.overflow-x-auto');
          if (tableOverflowContainer) {
            (tableOverflowContainer as HTMLElement).style.display = 'flex';
            (tableOverflowContainer as HTMLElement).style.justifyContent = 'center';
            (tableOverflowContainer as HTMLElement).style.width = '100%';
          }

          // Apply the exact grid template for the table
          const gridRows = clonedDoc.querySelectorAll('div[class*="grid-cols-[50px_1fr_80px_80px_100px_120px"]');
          gridRows.forEach((el: any) => {
            el.style.gridTemplateColumns = '50px 1fr 80px 80px 100px 120px';
            el.style.width = '100%';
            el.style.margin = '0 auto';
            el.style.display = 'grid';
          });

          // Set A4 minHeight on root container so footer (mt-auto) is pushed to the page bottom
          const pdfRoot = clonedDoc.querySelector('[data-pdf-root]') as HTMLElement | null;
          if (pdfRoot) {
            const w = pdfRoot.offsetWidth || pdfRoot.getBoundingClientRect().width;
            pdfRoot.style.minHeight = `${w * (297 / 210)}px`;
            pdfRoot.style.display = 'flex';
            pdfRoot.style.flexDirection = 'column';
            pdfRoot.style.justifyContent = 'space-between';
          }
        }
      });

      // ── CHANGE IMAGE FORMAT / QUALITY HERE ───────────────────────────────
      // First arg: 'image/jpeg' (smaller file) or 'image/png' (lossless, larger)
      // Second arg (only for JPEG): quality from 0.0 to 1.0. 0.8 = 80% quality.
      const imgData = canvas.toDataURL('image/jpeg', 1);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 1) { // 1mm threshold prevents blank pages from fractional pixel rounding
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;

      // ── PDF FILENAME ────────────────────────────────────────────────────────────
      // Format: CustomerName-QuoteID.pdf
      //   • selectedCustomer?.name  → the customer's name (falls back to 'Unknown' if none selected)
      //   • .replace(/[^a-zA-Z0-9_\-. ]/g, '') → strips characters that are illegal in
      //     filenames (e.g. / \ : * ? " < > |) — keeps letters, numbers, spaces, hyphens, dots
      //   • .trim()  → removes any leading/trailing spaces from the name
      //   • quoteId  → the quote number (e.g. AJ-10042)
      //   • '.pdf'   → file extension
      //
      // EXAMPLES:
      //   Customer "Acme Corp", quote AJ-10042  →  "Acme Corp-AJ-10042.pdf"
      //
      // TO CHANGE THE FORMAT:
      //   Remove customerName and the '-' to go back to just the quote ID:
      //     link.download = `${quoteId}.pdf`;
      //   Add the date:
      //     link.download = `${customerName}-${quoteId}-${date}.pdf`;
      //   Add document type (Quotation / Tax Invoice):
      //     link.download = `${type}-${customerName}-${quoteId}.pdf`;
      const customerName = (selectedCustomer?.name || 'Unknown')
        .replace(/[^a-zA-Z0-9_\-.\s]/g, '') // strip filename-unsafe characters
        .trim();
      link.download = `${customerName}-${quoteId}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const handleExportPDFWithStamp = async () => {
    if (!printRef.current) return;

    try {
      const originalElements = printRef.current.querySelectorAll('input, textarea, select');
      const elementData = Array.from(originalElements).map((el: any) => {
        const computedStyle = window.getComputedStyle(el);
        return {
          value: el.tagName === 'SELECT' ? el.options[el.selectedIndex]?.text : el.value,
          textAlign: computedStyle.textAlign,
          fontFamily: computedStyle.fontFamily,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          color: computedStyle.color,
          padding: computedStyle.padding,
        };
      });

      const canvas = await html2canvas(printRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const clonedElements = clonedDoc.querySelectorAll('input, textarea, select');
          clonedElements.forEach((el: any, index) => {
            const data = elementData[index];
            if (!data) return;

            const div = clonedDoc.createElement('div');
            div.innerText = data.value || '';
            div.className = el.className;
            div.style.textAlign = data.textAlign;
            div.style.fontFamily = data.fontFamily;
            div.style.fontSize = data.fontSize;
            div.style.fontWeight = data.fontWeight;
            div.style.color = data.color;
            div.style.padding = data.padding;
            div.style.whiteSpace = 'pre-wrap';
            div.style.wordBreak = 'break-word';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            if (data.textAlign === 'right') div.style.justifyContent = 'flex-end';
            if (data.textAlign === 'center') div.style.justifyContent = 'center';

            if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text')) {
              div.style.minHeight = el.offsetHeight ? `${el.offsetHeight}px` : (el.style.height || 'auto');
              div.style.height = 'auto';
              div.style.overflow = 'visible';
              div.style.alignItems = el.tagName === 'TEXTAREA' ? 'flex-start' : 'center';
              div.style.whiteSpace = 'pre-wrap';
              div.style.wordBreak = 'break-word';
            }

            div.style.border = 'none';
            div.style.background = 'transparent';

            el.parentNode?.replaceChild(div, el);
          });

          const hiddenElements = clonedDoc.querySelectorAll('.print\\:hidden');
          hiddenElements.forEach((el: any) => {
            el.style.display = 'none';
          });

          // FORCE THE STAMP TO BE VISIBLE FOR THIS EXPORT
          const stampSection = clonedDoc.getElementById('stamp-section');
          if (stampSection) {
            stampSection.style.display = 'flex';
          }

          const printBlockElements = clonedDoc.querySelectorAll('.print\\:block, .print\\:flex');
          printBlockElements.forEach((el: any) => {
            el.style.display = el.classList.contains('print:flex') ? 'flex' : 'block';
          });

          clonedDoc.querySelectorAll('.print\\:border-none').forEach((el: any) => {
            el.style.border = 'none';
          });

          clonedDoc.querySelectorAll('.print\\:overflow-visible').forEach((el: any) => {
            el.style.overflow = 'visible';
          });

          const tableOverflowContainer = clonedDoc.querySelector('.overflow-x-auto');
          if (tableOverflowContainer) {
            (tableOverflowContainer as HTMLElement).style.display = 'flex';
            (tableOverflowContainer as HTMLElement).style.justifyContent = 'center';
            (tableOverflowContainer as HTMLElement).style.width = '100%';
          }

          const gridRows = clonedDoc.querySelectorAll('div[class*="grid-cols-[50px_1fr_80px_80px_100px_120px"]');
          gridRows.forEach((el: any) => {
            el.style.gridTemplateColumns = '50px 1fr 80px 80px 100px 120px';
            el.style.width = '100%';
            el.style.margin = '0 auto';
            el.style.display = 'grid';
          });

          const pdfRoot = clonedDoc.querySelector('[data-pdf-root]') as HTMLElement | null;
          if (pdfRoot) {
            const w = pdfRoot.offsetWidth || pdfRoot.getBoundingClientRect().width;
            pdfRoot.style.minHeight = `${w * (297 / 210)}px`;
            pdfRoot.style.display = 'flex';
            pdfRoot.style.flexDirection = 'column';
            pdfRoot.style.justifyContent = 'space-between';
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 1);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 1) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;

      const customerName = (selectedCustomer?.name || 'Unknown')
        .replace(/[^a-zA-Z0-9_\-.\s]/g, '')
        .trim();
      link.download = `${customerName}-${quoteId}-stamped.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error generating PDF with Stamp:', error);
      alert('Failed to generate PDF with Stamp');
    }
  };

  const handleExportExcel = async () => {
    // Create quote info sheet
    const quoteInfo = [
      [type.toUpperCase()],
      ['Quote ID', quoteId],
      ['Date', date],
      ['Valid For', '30 Days'],
      // [''],
      ['CUSTOMER INFO'],
      ['Customer', selectedCustomer?.name || ''],
      ['Mobile', selectedCustomer?.mobile || ''],
      ['Address', selectedCustomer?.address || ''],
      ['Contact', selectedCustomer?.contact || ''],
      ['E-mail', selectedCustomer?.email || ''],
      ['Subject', subject, subjectAr],
      ['']
    ];

    // Create items sheet data
    const itemsData = [
      ['ITEM', 'DESCRIPTION', 'DESCRIPTION (ARABIC)', 'QTY', 'UNIT', 'UNIT PRICE', 'NET PRICE', 'MANUAL', 'BASE PRICE', 'BASE TOTAL', 'M.U. %'],
      ...items.map((item, index) => {
        const rule = getItemRule(item);
        let displayBase = 0;
        let displayTotal = 0;

        if (rule === 'EXCL') {
          displayBase = 0;
          displayTotal = 0;
        } else if (rule === 'ZM') {
          displayBase = item.unit_price || 0;
          displayTotal = item.net_price || 0;
        } else {
          if (rule === 'MAN') displayBase = item.manual_price || 0;
          else if (rule === 'DB') displayBase = item.original_price || 0;
          else displayBase = item.original_price || 0;
          displayTotal = displayBase * item.qty;
        }

        return [
          index + 1,
          item.description,
          item.description_ar || '',
          item.qty,
          item.unit,
          `SAR ${item.unit_price.toFixed(2)}`,
          `SAR ${item.net_price.toFixed(2)}`,
          item.manual_price !== undefined ? `SAR ${item.manual_price.toFixed(2)}` : '-',
          rule === 'EXCL' ? '-' : `SAR ${displayBase.toFixed(2)}`,
          rule === 'EXCL' ? '-' : `SAR ${displayTotal.toFixed(2)}`,
          index === 0 ? `${markup}%` : ''
        ];
      }),
      ['', '', '', '', '', 'SUBTOTAL', `SAR ${subtotal.toFixed(2)}`, '', 'B.TOTAL', `SAR ${baseTotal.toFixed(2)}`],
      ['', '', '', '', '', 'DISCOUNT', `SAR ${discount.toFixed(2)}`],
      ['', '', '', '', '', 'VAT (15%)', `SAR ${tax.toFixed(2)}`],
      ['', '', '', '', '', 'TOTAL PACKAGE', `SAR ${grandTotal.toFixed(2)}`, '', 'TTL PROFIT', `SAR ${markupProfit.toFixed(2)}`],
      [''],
      ['TERMS & CONDITIONS'],
      ...(showNote ? [[noteHeader, note, noteAr]] : []),
      ...(showPayment ? [['PAYMENT', payment, paymentAr]] : []),
      ...(showWarranty ? [['WARRANTY', warranty, warrantyAr]] : []),
      ...(showManpower ? [['MANPOWER', manpower, manpowerAr]] : []),
      ...(showMobilization ? [['MOBILIZATION', mobilization, mobilizationAr]] : []),
      ...(showDuration ? [['DURATION', duration, durationAr]] : []),
      ...(showBankDetails ? [['BANK DETAILS', bankDetails, bankDetailsAr]] : []),
      [''],
      ['FOOTER', footer, footerAr]
    ];

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Quote');

    ws.columns = [
      { key: 'A', width: 6 },
      { key: 'B', width: 45 },
      { key: 'C', width: 45 },
      { key: 'D', width: 6 },
      { key: 'E', width: 8 },
      { key: 'F', width: 15 },
      { key: 'G', width: 15 },
      { key: 'H', width: 12 },
      { key: 'I', width: 15 },
      { key: 'J', width: 15 },
      { key: 'K', width: 10 },
    ];

    const allData = [...quoteInfo, ...itemsData];
    allData.forEach(rowData => {
      const row = ws.addRow(rowData);
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.font = { name: 'Arial', size: 10 };
      });
    });

    // Apply bold to headers and specific cells
    ws.eachRow((row, rowNumber) => {
      const firstCellVal = row.getCell(1).value?.toString();
      if (rowNumber === 1 || firstCellVal === 'CUSTOMER INFO' || firstCellVal === 'TERMS & CONDITIONS' || firstCellVal === 'ITEM' || firstCellVal === 'DESCRIPTION') {
        row.eachCell(cell => {
          if (cell.value) {
            cell.font = { name: 'Arial', size: 10, bold: true };
          }
        });
      }

      // STYLIZE ROW: headers
      if (firstCellVal === 'ITEM') {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
      }

      // STYLIZE SUBTOTAL, DISCOUNT, VAT, TOTAL PACKAGE
      const col6Val = row.getCell(6).value?.toString();
      const col9Val = row.getCell(9).value?.toString();
      
      if (col6Val === 'SUBTOTAL' || col6Val === 'DISCOUNT' || col6Val === 'VAT (15%)' || col6Val === 'TOTAL PACKAGE') {
        row.getCell(6).font = { name: 'Arial', size: 10, bold: true };
        row.getCell(7).font = { name: 'Arial', size: 10, bold: true };
        row.getCell(9).font = { name: 'Arial', size: 10, bold: true };
        row.getCell(10).font = { name: 'Arial', size: 10, bold: true };
        
        if (col6Val === 'TOTAL PACKAGE') {
           row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4ADE80' } }; // green
           row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4ADE80' } }; 
        }
        if (col9Val === 'TTL PROFIT') {
           row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFACC15' } }; // yellow
           row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFACC15' } }; 
        }
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // ── EXCEL FILENAME ──────────────────────────────────────────────────────────
    // Same naming convention as the PDF export above.
    const excelCustomerName = (selectedCustomer?.name || 'Unknown')
      .replace(/[^a-zA-Z0-9_\-.\s]/g, '') // strip filename-unsafe characters
      .trim();
    saveAs(blob, `${excelCustomerName}-${quoteId}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6 dark:text-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded-xl text-indigo-700 dark:text-indigo-400">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Document Editor</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                status === 'Draft' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                status === 'Invoiced' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' :
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
              }`}>
                {status}
              </span>
              <span className="text-xs text-gray-400 font-mono">v{version}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button onClick={clearForm} className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
            <RefreshCw size={18} /> Clear
          </button>
          <button onClick={recordQuote} className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
            <Save size={18} /> Record
          </button>
          <button onClick={handleTranslateAll} className="flex items-center gap-2 px-4 py-2 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors" title="Translate all empty Arabic fields">
            <Languages size={18} /> Translate
          </button>
          {recallQuoteId && (
            <>
              <button onClick={handleDuplicate} className="flex items-center gap-2 px-4 py-2 text-white bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors" title="Copy all data to a new Quote ID">
                <Copy size={18} /> Duplicate
              </button>
              <button onClick={handleCreateRevision} className="flex items-center gap-2 px-4 py-2 text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors" title="Clone exact form into new Revision ID">
                Create Revision
              </button>
              {type !== 'Tax Invoice' && (user.role === 'admin' || user.permissions?.canConvertInvoice) && workflowVisibility.invoice && (
                <button onClick={handleConvertToInvoice} className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors" title="Switch type to Tax Invoice">
                  To Invoice
                </button>
              )}
            </>
          )}
          {/* ── TEMPLATE BUTTONS ───────────────────────────────────────────────────── */}
          {(user.role === 'admin' || user.permissions?.canSaveTemplate) && workflowVisibility.template && (
            <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-2 px-4 py-2 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors" title="Save current Terms as a reusable template">
              <Bookmark size={18} /> Save Template
            </button>
          )}
          {templates.length > 0 && workflowVisibility.template && (
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors">
                <BookOpen size={18} /> Load Template ▾
              </button>
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[180px] hidden group-hover:block">
                {templates.map(t => (
                  <div key={t.name} className="flex items-center hover:bg-amber-50 dark:hover:bg-amber-900/20 group/item">
                    <button onClick={() => applyTemplate(t)} className="flex-1 text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                      {t.name}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTemplate(t.name); }}
                      className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                      title="Delete Template"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(user.role === 'admin' || user.permissions?.canEmailQuote) && workflowVisibility.email && (
            <button onClick={handleSendEmail} disabled={isSending} className="flex items-center gap-2 px-4 py-2 text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors disabled:opacity-50">
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Email
            </button>
          )}
          {(user.role === 'admin' || user.permissions?.canPrintQuote) && workflowVisibility.print && (
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
              <Printer size={18} /> Print
            </button>
          )}

          <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
            <FileSpreadsheet size={18} /> Export Excel
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Download size={18} /> Export PDF
          </button>
          {stampUrl && (
            <button onClick={handleExportPDFWithStamp} className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors" title="Export PDF with company stamp">
              <Download size={18} /> Export PDF + Stamp
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Printable Quote Form */}
        <div
          ref={printRef}
          data-pdf-root="true"
          className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none flex-1 transition-all flex flex-col"
        >
          <div ref={formTopRef} className="flex flex-col">
            {/* App Configuration / Status selectors - Print Hidden */}
            <div className="flex flex-wrap gap-4 mb-6 print:hidden bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 uppercase">Document Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={type === 'Tax Invoice' && user.role !== 'admin' && !user.permissions?.canConvertInvoice}
                  className="bg-transparent border-b border-gray-300 outline-none font-medium py-1 disabled:opacity-50"
                >
                  <option value="Quotation">Quotation</option>
                  {(user.role === 'admin' || user.permissions?.canConvertInvoice || type === 'Tax Invoice') && workflowVisibility.invoice && (
                    <option value="Tax Invoice">Tax Invoice</option>
                  )}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-transparent border-b border-gray-300 outline-none font-medium py-1">
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* ── DOCUMENT HEADER (Title + Quote ID/Date + Logo) ─────────────────
              The big title on the left (QUOTATION / TAX INVOICE) is driven by
              the {type} variable set in the Document Type dropdown.

              TITLE FONT SIZE: change 'text-3xl md:text-4xl' below.
                Tailwind sizes: text-lg, text-xl, text-2xl, text-3xl, text-4xl, text-5xl

              TITLE COLOR: change 'text-gray-900' to e.g. 'text-indigo-900'.
          ────────────────────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start pb-2 mb-2">
              <div className="mb-4 md:mb-0">
                {/* ── Document title: QUOTATION or TAX INVOICE ─────────────── */}
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-4 uppercase break-words">{type}</h1>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-lg">
                  <span className="font-semibold text-gray-700">Quote ID / رقم العرض:</span>
                  <input type="text" value={quoteId} onChange={e => setQuoteId(e.target.value)} className="font-mono text-gray-900 outline-none border-b border-transparent hover:border-gray-300 focus:border-indigo-500 bg-transparent" />

                  <span className="font-semibold text-gray-700">Date / التاريخ:</span>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-gray-900 outline-none border-b border-transparent hover:border-gray-300 focus:border-indigo-500 bg-transparent" />

                  <span className="font-semibold text-gray-700">Valid Until / صالح لغاية:</span>
                  <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="text-gray-900 outline-none border-b border-transparent hover:border-gray-300 focus:border-indigo-500 bg-transparent" />
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    className="object-contain mb-2"
                    style={{ height: `${logoSize * 0.25}rem` }} // Convert tailwind spacing (e.g. h-24 is 6rem)
                  />
                ) : (
                  <div className="flex-col items-end">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-2">
                      <div className="text-green-600 font-bold text-2xl">AJ</div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">NETWORK</h2>
                    <h2 className="text-xl font-bold text-gray-900">SOLUTIONS</h2>
                  </div>
                )}
              </div>
            </div>

            {/* ── CUSTOMER INFO BOX ─────────────────────────────────────────────
              The bordered section showing customer name, address, subject, etc.

              OUTER BORDER THICKNESS: change 'border-2' (2px). Options: border, border-2, border-4.
              OUTER BORDER COLOR:     change 'border-gray-800' to e.g. 'border-indigo-800'.

              SECTION HEADER BACKGROUND:
                Change 'bg-gray-100' to another color, e.g. 'bg-indigo-100'.
              SECTION HEADER TEXT SIZE:
                Change 'text-lg' to 'text-sm', 'text-base', 'text-xl', etc.
          ────────────────────────────────────────────────────────────────── */}
            <div className="border-2 border-gray-800 mb-6">
              {/* Header bar: "CUSTOMER INFO" label
                Background color → bg-gray-100 | Text size → text-lg */}
              <div className="bg-gray-100 px-3 pt-0 pb-3 border-b-2 border-gray-800 font-bold text-lg">
                CUSTOMER INFO
              </div>
              <div className="px-4 py-2 grid grid-cols-[100px_1fr_100px_1fr] gap-y-0.5 text-base items-center">
                <span className="font-bold flex items-center">Customer:</span>
                <div className="relative w-full z-50 flex items-center">
                  <input
                    type="text"
                    className="w-full p-0 border border-gray-300 rounded outline-none focus:border-indigo-500 print:appearance-none print:border-none print:bg-transparent"
                    placeholder="Search or select customer..."
                    value={customerSearch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomerSearch(val);
                      const c = customers.find(cust => cust.name.toLowerCase() === val.toLowerCase());
                      if (c) {
                        setSelectedCustomerId(c.id);
                        setSelectedCustomer(c);
                      } else {
                        setSelectedCustomerId('');
                        setSelectedCustomer(null);
                      }
                    }}
                    onFocus={() => setCustomerFocused(true)}
                    onBlur={() => setTimeout(() => setCustomerFocused(false), 200)}
                  />
                  {customerFocused && customerSearch.length > 0 && (
                    <div className="absolute top-full mt-1 z-[100] w-full bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto print:hidden">
                      {customers
                        .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) && c.name.toLowerCase() !== customerSearch.toLowerCase())
                        .map(c => (
                          <div
                            key={c.id}
                            className="cursor-pointer hover:bg-gray-100 px-3 py-2 text-sm"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setCustomerSearch(c.name);
                              setSelectedCustomerId(c.id);
                              setSelectedCustomer(c);
                              setCustomerFocused(false);
                            }}
                          >
                            {c.name}
                          </div>
                        ))}
                      {customerSearch.length > 0 && !customers.some(c => c.name.toLowerCase() === customerSearch.toLowerCase()) && (
                        <div
                          className="cursor-pointer hover:bg-gray-100 px-3 py-2 text-sm text-indigo-600 font-semibold border-t border-gray-100 flex items-center gap-2"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setAddCustomerModal({ name: customerSearch, mobile: '', address: '', contact: '', email: '' })}
                        >
                          <Plus size={14} />
                          Add "{customerSearch}" to Customer DB
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <span className="font-bold pl-4 flex items-center">Mobile:</span>
                <input
                  type="text"
                  className="font-mono flex items-center outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 w-full"
                  value={selectedCustomer?.mobile || ''}
                  onChange={e => selectedCustomer && setSelectedCustomer({ ...selectedCustomer, mobile: e.target.value })}
                />

                <span className="font-bold flex items-center">Address:</span>
                <input
                  type="text"
                  className="col-span-3 flex items-center outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 w-full"
                  value={selectedCustomer?.address || ''}
                  onChange={e => selectedCustomer && setSelectedCustomer({ ...selectedCustomer, address: e.target.value })}
                />

                <span className="font-bold flex items-center">Contact:</span>
                <input
                  type="text"
                  className="flex items-center outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 w-full"
                  value={selectedCustomer?.contact || ''}
                  onChange={e => selectedCustomer && setSelectedCustomer({ ...selectedCustomer, contact: e.target.value })}
                />

                <span className="font-bold pl-4 flex items-center">E-mail:</span>
                <input
                  type="text"
                  className="flex items-center outline-none bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 w-full"
                  value={selectedCustomer?.email || ''}
                  onChange={e => selectedCustomer && setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                />

                <span className="font-bold flex items-center" style={{ marginTop: '8px' }}>Subject:</span>
                <div className="col-span-3 flex items-center border border-gray-300 rounded focus-within:border-indigo-500 overflow-hidden print:border-none print:p-0 bg-white print:bg-transparent group/subject" style={{ marginTop: '8px', alignItems: 'center' }}>
                  <div className="flex-1 flex items-center">
                    <input
                      type="text"
                      className="flex-1 py-0.5 px-0 outline-none bg-transparent"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      onBlur={() => handleAutoTranslate(subject, subjectAr, setSubjectAr)}
                      placeholder="e.g., Supply, Installation and Configuration of IP Video Doorbell"
                    />
                  </div>
                  <div className="w-px h-6 bg-gray-200 print:hidden mx-1"></div>
                  <input
                    type="text"
                    dir="rtl"
                    className="flex-1 py-1.5 px-2 outline-none bg-transparent text-right"
                    value={subjectAr}
                    onChange={e => setSubjectAr(e.target.value)}
                    placeholder="توليد وتركيب وتكوين جرس الباب بالفيديو IP"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* ── ITEMS TABLE ─────────────────────────────────────────────────── */}
          <div className="w-full min-w-0 mb-6">
            <div className="overflow-x-auto overflow-y-visible print:overflow-visible">
              <div className="min-w-[1350px] print:min-w-0">
                <div className="border-2" style={{ borderColor: '#1f2937' }}>
                  {/* ── TABLE HEADER ROW ──────────────────────────────────────────
                    backgroundColor: '#dcfce7' = light green — change to recolor.
                    borderColor:     '#1f2937' = dark gray   — change to recolor.
                */}
                  <div
                    ref={headerRef}
                    className="grid grid-cols-[48px_1fr_64px_64px_110px_110px_36px] border-b-2 font-bold text-base text-center print:grid-cols-[48px_1fr_64px_64px_110px_110px]"
                    style={{ backgroundColor: themeColors.headerBg, color: themeColors.headerText, borderColor: '#1f2937' }}
                  >
                    <div className="pt-0 pb-3 px-1 border-r border-gray-800 h-full">ITEM</div>
                    <div className="pt-0 pb-3 px-2 border-r border-gray-800 h-full">
                      DESCRIPTION
                    </div>
                    <div className="pt-0 pb-3 px-1 border-r border-gray-800 h-full">QTY</div>
                    <div className="pt-0 pb-3 px-1 border-r border-gray-800 h-full">UNIT</div>
                    <div className="pt-0 pb-3 px-2 border-r border-gray-800 h-full">UNIT PRICE</div>
                    <div className="pt-0 pb-3 px-2 border-r border-gray-800 h-full">NET PRICE</div>
                    <div className="print:hidden h-full" />
                  </div>
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      data-row-index={index}
                      className="flex items-stretch print:block"
                      onPointerDown={rowReorderMode === 'drag' ? (e) => onRowBodyPointerDown(e, index) : undefined}
                      onPointerMove={rowReorderMode === 'drag' ? onRowBodyPointerMove : undefined}
                      onPointerUp={rowReorderMode === 'drag' ? onRowBodyPointerUp : undefined}
                      onPointerCancel={rowReorderMode === 'drag' ? pointerCancelDrag : undefined}
                    >
                      <div
                        ref={el => rowRefs.current[index] = el}
                        className={`flex-1 grid grid-cols-[48px_1fr_64px_64px_110px_110px_36px] border-b border-gray-300 last:border-b-0 text-base items-start print:grid-cols-[48px_1fr_64px_64px_110px_110px] transition-opacity
                          ${focusedDescriptionIndex === index ? 'relative z-50' : 'relative z-0'}
                          ${dragIndex === index ? 'opacity-30' : 'opacity-100'}
                          ${dragOverIndex === index && dragIndex !== index ? 'border-t-2 border-indigo-500' : ''}
                        `}
                        style={{ backgroundColor: index % 2 === 0 ? themeColors.stripeBg : 'transparent' }}>
                        <div
                          className="px-1 py-0.5 text-center border-r border-gray-300 h-full flex flex-col items-center justify-start pt-1 group/grip cursor-grab active:cursor-grabbing touch-none select-none print:cursor-auto"
                          onPointerDown={(e) => onGripPointerDown(e, index)}
                          onPointerMove={onGripPointerMove}
                          onPointerUp={onGripPointerUp}
                          onPointerCancel={pointerCancelDrag}
                        >
                          <span className="group-hover/grip:hidden font-medium text-gray-500 print:block">{index + 1}</span>
                          <div className="hidden group-hover/grip:flex print:hidden items-center justify-center text-gray-400 h-[24px]">
                            <GripVertical size={16} />
                          </div>
                          {(item.unit_price === 0 || (item.original_price !== undefined && item.unit_price < item.original_price)) && (
                            <span className="print:hidden mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold" title={item.unit_price === 0 ? 'Price is 0!' : `Below DB price (${item.original_price})`}>!</span>
                          )}
                        </div>
                        <div className="p-0 border-r border-gray-300 h-full flex relative group">
                          <div className="px-2 py-0.5 w-1/2 flex flex-col justify-center relative">
                            <textarea
                              ref={el => { descriptionRefs.current[index] = el; }}
                              className="w-full outline-none bg-transparent resize-none overflow-hidden min-h-[40px] relative z-0"
                              value={item.description}
                              placeholder="Type to search product..."
                              onChange={e => updateItem(index, 'description', e.target.value)}
                              onFocus={() => {
                                if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                                setFocusedDescriptionIndex(index);
                              }}
                              onBlur={() => {
                                blurTimeoutRef.current = setTimeout(() => setFocusedDescriptionIndex(null), 200);
                                handleProductAutoTranslate(index, item.description, item.description_ar || '');
                              }}
                              rows={item.description.split('\n').length || 1}
                            />

                            {/* ── Product search dropdown — fixed-position via useEffect ── */}
                            {focusedDescriptionIndex === index && item.description.length > 1 && dropdownPos && (() => {
                              const searchTerms = item.description.toLowerCase().split(/\s+/).filter(t => t.length > 0);
                              const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                              const exactMatch = products.some(p => p.description.toLowerCase() === item.description.trim().toLowerCase());
                              const matched = searchTerms.length === 0 ? [] : products.filter(p => {
                                const desc = p.description.toLowerCase();
                                const normDesc = normalize(desc);
                                return searchTerms.every(term => {
                                  const nTerm = normalize(term);
                                  return desc.includes(term) || (nTerm && normDesc.includes(nTerm));
                                });
                              });
                              return (
                                <div
                                  className="product-dropdown print:hidden"
                                  style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
                                >
                                  <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
                                    <div className="max-h-52 overflow-y-auto">
                                      {matched.length === 0 && !exactMatch && (
                                        <div className="px-3 py-2.5 text-xs text-gray-400 italic">No matching products found</div>
                                      )}
                                      {matched.map(p => (
                                        <div
                                          key={p.id}
                                          className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0"
                                          onMouseDown={e => e.preventDefault()}
                                          onClick={() => {
                                            handleProductSelect(index, p.id.toString());
                                            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                                            setFocusedDescriptionIndex(null);
                                            handleProductAutoTranslate(index, p.description, '');
                                          }}
                                        >
                                          <div className="font-medium text-gray-800">{p.description}</div>
                                          {p.description_ar && <div className="text-xs text-gray-500 text-right" dir="rtl">{p.description_ar}</div>}
                                          <div className="text-xs text-gray-400 mt-0.5">{p.unit} · {p.unit_price.toFixed(2)}</div>
                                        </div>
                                      ))}
                                    </div>
                                    {/* Add to Product DB — opens a proper modal, no focus issues */}
                                    {!exactMatch && (
                                      <div
                                        className="px-3 py-2.5 flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 cursor-pointer border-t border-indigo-100 bg-white"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => {
                                          setAddProductModal({ rowIndex: index, description: item.description.trim(), unit: 'Pc', price: '0' });
                                          if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                                          setFocusedDescriptionIndex(null);
                                        }}
                                      >
                                        <Plus size={14} />
                                        Add "{item.description.trim()}" to Product DB
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                            <div className="absolute right-1 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 print:hidden">
                              <div className="relative flex items-center">
                                <ChevronDown size={14} className="text-gray-400 pointer-events-none" />
                                <select
                                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                  onChange={(e) => handleProductSelect(index, e.target.value)}
                                  value=""
                                  title="Select from Product DB"
                                >
                                  <option value="">+</option>
                                  {products.map(p => <option key={p.id} value={p.id}>{p.description}</option>)}
                                </select>
                              </div>
                            </div>
                            {/* Private note — screen only, hidden from print */}
                            {expandedNoteIndex === index && (
                              <div className="print:hidden mt-1 pt-1 border-t border-dashed border-amber-300">
                                <textarea
                                  autoFocus
                                  className="w-full text-xs bg-amber-50 outline-none resize-none text-amber-900 placeholder:text-amber-400 rounded px-1.5 py-1"
                                  placeholder="Private note (not printed)…"
                                  value={item.internal_note || ''}
                                  onChange={e => updateItem(index, 'internal_note', e.target.value)}
                                  rows={Math.max(1, (item.internal_note || '').split('\n').length)}
                                />
                              </div>
                            )}
                          </div>
                          <div className="w-px bg-gray-200 print:hidden shrink-0 my-1"></div>
                          <div className="px-2 py-0.5 w-1/2 flex flex-col justify-center relative">
                            {translatingRows.has(index) && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded z-10 print:hidden pointer-events-none">
                                <span className="text-[10px] text-indigo-500 font-semibold animate-pulse">Translating…</span>
                              </div>
                            )}
                            <textarea
                              dir="rtl"
                              className="w-full outline-none bg-transparent resize-none overflow-hidden text-right min-h-[40px]"
                              value={item.description_ar || ''}
                              onChange={e => updateItem(index, 'description_ar', e.target.value)}
                              placeholder="الوصف بالعربية..."
                              rows={(item.description_ar || '').split('\n').length || 1}
                            />
                          </div>
                        </div>
                        <div className="px-1 py-0.5 border-r border-gray-300 h-full flex items-start pt-1.5">
                          <input
                            type="number"
                            className="w-full text-center text-base outline-none bg-transparent"
                            value={item.qty || ''}
                            onChange={e => updateItem(index, 'qty', parseFloat(e.target.value) || 0)}
                            min="1"
                          />
                        </div>
                        <div className="px-1 py-0.5 border-r border-gray-300 h-full flex items-start pt-1.5">
                          <input
                            type="text"
                            list="unit-suggestions"
                            className="w-full text-center text-base outline-none bg-transparent"
                            value={item.unit}
                            onChange={e => updateItem(index, 'unit', e.target.value)}
                          />
                        </div>
                        <div className={`px-2 py-0.5 border-r border-gray-300 h-full flex items-start pt-1.5 font-mono text-base ${item.unit_price === 0 || (item.original_price !== undefined && item.unit_price < item.original_price) ? 'text-amber-600' : ''}`}>
                          <input
                            type="text"
                            className="w-full text-center text-base font-mono outline-none bg-transparent"
                            value={item.unit_price ? item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                            onFocus={(e) => {
                              e.target.type = 'number';
                              e.target.value = item.unit_price ? item.unit_price.toString() : '';
                            }}
                            onBlur={(e) => {
                              e.target.type = 'text';
                              e.target.value = item.unit_price ? item.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
                            }}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              updateItem(index, 'unit_price', isNaN(val) ? 0 : val);
                            }}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className={`px-2 py-0.5 border-r border-gray-300 font-mono font-medium text-base h-full flex items-start pt-1.5 justify-center ${item.unit_price === 0 ? 'text-amber-600' : ''}`}>
                          <span className="w-full text-center">{item.net_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {/* Controls — always visible, note + trash, inside grid */}
                        <div className="print:hidden flex flex-col items-center justify-start pt-1 gap-1">
                          <button
                            onClick={() => setExpandedNoteIndex(expandedNoteIndex === index ? null : index)}
                            className={`p-0.5 rounded transition-colors ${
                              expandedNoteIndex === index ? 'text-amber-600 bg-amber-100'
                              : item.internal_note ? 'text-amber-500 hover:text-amber-700'
                              : 'text-gray-400 hover:text-amber-500'
                            }`}
                            title={item.internal_note ? 'Edit private note' : 'Add private note'}
                          >
                            <StickyNote size={14} />
                          </button>
                          <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 transition-colors p-0.5" title="Remove Item">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>{/* /border box */}
                <div className="p-2 print:hidden flex items-center gap-4">
                  <button onClick={addItem} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                    <Plus size={16} /> Add Row
                  </button>
                  {(() => {
                    const u = JSON.parse(localStorage.getItem('user') || '{}');
                    const canRFQ = u.role === 'admin' || !!u.permissions?.canUseRFQ;
                    return canRFQ ? (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isRfqLoading}
                        className="flex items-center gap-1 text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {isRfqLoading ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                        {isRfqLoading ? 'Parsing AI...' : 'Import from RFQ'}
                      </button>
                    ) : null;
                  })()}
                  <input type="file" ref={fileInputRef} hidden accept="image/*,application/pdf" onChange={handleRfqUpload} />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Terms & Totals */}
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-4">
            {/* Terms & Conditions */}
            <div className="flex-1 space-y-2 [&_input]:text-[inherit] [&_textarea]:text-[inherit]" style={{ fontSize: `${termsFontSize}px` }}>
              {showNote && (
                <div className="flex flex-col md:flex-row gap-2 group relative">
                  <span className="font-bold w-40 shrink-0">
                    <input type="text" className="w-full bg-transparent outline-none font-bold uppercase" value={noteHeader} onChange={(e) => setNoteHeader(e.target.value)} />
                  </span>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative group/note flex flex-col justify-center">
                      <textarea
                        className="w-full outline-none bg-transparent resize-none overflow-hidden"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        onBlur={() => handleAutoTranslate(note, noteAr, setNoteAr)}
                        rows={note.split('\n').length || 2}
                      />
                    </div>
                    <textarea
                      dir="rtl"
                      className="w-full outline-none bg-transparent resize-none overflow-hidden text-right"
                      value={noteAr}
                      onChange={e => setNoteAr(e.target.value)}
                      rows={noteAr.split('\n').length || 2}
                    />
                  </div>
                  <input type="checkbox" className="print:hidden cursor-pointer h-4 w-4 shrink-0 mx-1 mt-1" checked={showNote} onChange={(e) => setShowNote(e.target.checked)} title="Hide Note" />
                </div>
              )}
              {!showNote && (
                <div className="flex gap-2 print:hidden items-center text-gray-400 italic">
                  <input type="checkbox" className="cursor-pointer h-4 w-4" checked={showNote} onChange={(e) => setShowNote(e.target.checked)} title="Show Note" />
                  <span>Show Note Section</span>
                </div>
              )}

              <div className="flex flex-col gap-y-0.5 mt-4">
                {showPayment ? (
                  <div className="flex flex-col md:flex-row md:items-center group">
                    <span className="font-bold w-40 shrink-0 text-base">PAYMENT:</span>
                    <div className="flex-1 flex items-center group/field relative">
                      <input type="text" className="flex-1 outline-none bg-transparent italic" value={payment} onChange={e => setPayment(e.target.value)} onBlur={() => handleAutoTranslate(payment, paymentAr, setPaymentAr)} />
                    </div>
                    <input type="text" dir="rtl" className="flex-1 outline-none bg-transparent text-right font-medium" value={paymentAr} onChange={e => setPaymentAr(e.target.value)} />
                    <input type="checkbox" className="print:hidden cursor-pointer h-4 w-4 shrink-0 mx-1" checked={showPayment} onChange={(e) => setShowPayment(e.target.checked)} title="Hide Payment" />
                  </div>
                ) : (
                  <div className="print:hidden flex items-center gap-2 text-gray-400 italic">
                    <input type="checkbox" className="cursor-pointer h-4 w-4" checked={showPayment} onChange={(e) => setShowPayment(e.target.checked)} title="Show Payment" />
                    <span>Show Payment</span>
                  </div>
                )}

                {showWarranty ? (
                  <div className="flex flex-col md:flex-row md:items-center group">
                    <span className="font-bold w-40 shrink-0 text-base">WARRANTY:</span>
                    <div className="flex-1 flex items-center group/field relative">
                      <input type="text" className="flex-1 outline-none bg-transparent" value={warranty} onChange={e => setWarranty(e.target.value)} onBlur={() => handleAutoTranslate(warranty, warrantyAr, setWarrantyAr)} />
                    </div>
                    <input type="text" dir="rtl" className="flex-1 outline-none bg-transparent text-right font-medium" value={warrantyAr} onChange={e => setWarrantyAr(e.target.value)} />
                    <input type="checkbox" className="print:hidden cursor-pointer h-4 w-4 shrink-0 mx-1" checked={showWarranty} onChange={(e) => setShowWarranty(e.target.checked)} title="Hide Warranty" />
                  </div>
                ) : (
                  <div className="print:hidden flex items-center gap-2 text-gray-400 italic">
                    <input type="checkbox" className="cursor-pointer h-4 w-4" checked={showWarranty} onChange={(e) => setShowWarranty(e.target.checked)} title="Show Warranty" />
                    <span>Show Warranty</span>
                  </div>
                )}

                {showManpower ? (
                  <div className="flex flex-col md:flex-row md:items-center group">
                    <span className="font-bold w-40 shrink-0 text-base">MANPOWER:</span>
                    <div className="flex-1 flex items-center group/field relative">
                      <input type="text" className="flex-1 outline-none bg-transparent" value={manpower} onChange={e => setManpower(e.target.value)} onBlur={() => handleAutoTranslate(manpower, manpowerAr, setManpowerAr)} />
                    </div>
                    <input type="text" dir="rtl" className="flex-1 outline-none bg-transparent text-right font-medium" value={manpowerAr} onChange={e => setManpowerAr(e.target.value)} />
                    <input type="checkbox" className="print:hidden cursor-pointer h-4 w-4 shrink-0 mx-1" checked={showManpower} onChange={(e) => setShowManpower(e.target.checked)} title="Hide Manpower" />
                  </div>
                ) : (
                  <div className="print:hidden flex items-center gap-2 text-gray-400 italic">
                    <input type="checkbox" className="cursor-pointer h-4 w-4" checked={showManpower} onChange={(e) => setShowManpower(e.target.checked)} title="Show Manpower" />
                    <span>Show Manpower</span>
                  </div>
                )}

                {showMobilization ? (
                  <div className="flex flex-col md:flex-row md:items-center group">
                    <span className="font-bold w-40 shrink-0 text-base">MOBILIZATION:</span>
                    <div className="flex-1 flex items-center group/field relative">
                      <input type="text" className="flex-1 outline-none bg-transparent" value={mobilization} onChange={e => setMobilization(e.target.value)} onBlur={() => handleAutoTranslate(mobilization, mobilizationAr, setMobilizationAr)} />
                    </div>
                    <input type="text" dir="rtl" className="flex-1 outline-none bg-transparent text-right font-medium" value={mobilizationAr} onChange={e => setMobilizationAr(e.target.value)} />
                    <input type="checkbox" className="print:hidden cursor-pointer h-4 w-4 shrink-0 mx-1" checked={showMobilization} onChange={(e) => setShowMobilization(e.target.checked)} title="Hide Mobilization" />
                  </div>
                ) : (
                  <div className="print:hidden flex items-center gap-2 text-gray-400 italic">
                    <input type="checkbox" className="cursor-pointer h-4 w-4" checked={showMobilization} onChange={(e) => setShowMobilization(e.target.checked)} title="Show Mobilization" />
                    <span>Show Mobilization</span>
                  </div>
                )}

                {showDuration ? (
                  <div className="flex flex-col md:flex-row md:items-center group">
                    <span className="font-bold w-40 shrink-0 text-base">DURATION:</span>
                    <div className="flex-1 flex items-center group/field relative">
                      <input type="text" className="flex-1 outline-none bg-transparent" value={duration} onChange={e => setDuration(e.target.value)} onBlur={() => handleAutoTranslate(duration, durationAr, setDurationAr)} />
                    </div>
                    <input type="text" dir="rtl" className="flex-1 outline-none bg-transparent text-right font-medium" value={durationAr} onChange={e => setDurationAr(e.target.value)} />
                    <input type="checkbox" className="print:hidden cursor-pointer h-4 w-4 shrink-0 mx-1" checked={showDuration} onChange={(e) => setShowDuration(e.target.checked)} title="Hide Duration" />
                  </div>
                ) : (
                  <div className="print:hidden flex items-center gap-2 text-gray-400 italic">
                    <input type="checkbox" className="cursor-pointer h-4 w-4" checked={showDuration} onChange={(e) => setShowDuration(e.target.checked)} title="Show Duration" />
                    <span>Show Duration</span>
                  </div>
                )}

                {showBankDetails ? (
                  <div className="flex flex-col md:flex-row md:items-start group mt-1">
                    <span className="font-bold w-40 shrink-0 mt-1 text-base">BANK DETAILS:</span>
                    <div className="flex-1 flex flex-col justify-center relative group/bank pr-2">
                      <textarea
                        className="w-full outline-none bg-transparent resize-none overflow-hidden font-mono"
                        value={bankDetails}
                        onChange={e => setBankDetails(e.target.value)}
                        onBlur={() => handleAutoTranslate(bankDetails, bankDetailsAr, setBankDetailsAr)}
                        rows={bankDetails.split('\n').length || 3}
                      />
                    </div>
                    <textarea
                      dir="rtl"
                      className="flex-1 outline-none bg-transparent resize-none overflow-hidden text-right font-mono"
                      value={bankDetailsAr}
                      onChange={e => setBankDetailsAr(e.target.value)}
                      rows={bankDetailsAr.split('\n').length || 3}
                    />
                    <input type="checkbox" className="print:hidden cursor-pointer h-4 w-4 shrink-0 mx-1 mt-1" checked={showBankDetails} onChange={(e) => setShowBankDetails(e.target.checked)} title="Hide Bank Details" />
                  </div>
                ) : (
                  <div className="print:hidden flex items-center gap-2 text-gray-400 italic mt-2">
                    <input type="checkbox" className="cursor-pointer h-4 w-4" checked={showBankDetails} onChange={(e) => setShowBankDetails(e.target.checked)} title="Show Bank Details" />
                    <span>Show Bank Details</span>
                  </div>
                )}

                {showCustomField && customFields.length > 0 ? (
                  <div className="flex flex-col gap-2 mt-2">
                    {customFields.map((cf, index) => (
                      <div key={cf.id} className="flex flex-col md:flex-row gap-2 group relative">
                        <span className="font-bold w-40 shrink-0 text-base">
                          <input type="text" className="w-full bg-transparent outline-none font-bold uppercase" value={cf.header} onChange={(e) => updateCustomField(index, 'header', e.target.value)} />
                        </span>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="relative group/custom flex flex-col justify-center pr-2">
                            <textarea
                              className="w-full outline-none bg-transparent resize-none overflow-hidden"
                              value={cf.value}
                              onChange={e => updateCustomField(index, 'value', e.target.value)}
                              onBlur={() => {
                                if (!cf.value) return;
                                handleAutoTranslate(cf.value, cf.valueAr, (val) => updateCustomField(index, 'valueAr', val));
                              }}
                              rows={cf.value.split('\n').length || 1}
                            />
                          </div>
                          <textarea
                            dir="rtl"
                            className="w-full outline-none bg-transparent resize-none overflow-hidden text-right"
                            value={cf.valueAr}
                            onChange={e => updateCustomField(index, 'valueAr', e.target.value)}
                            rows={cf.valueAr.split('\n').length || 2}
                            placeholder="التفاصيل المخصصة..."
                          />
                        </div>
                        <div className="print:hidden flex items-center gap-1 mx-1 mt-1 shrink-0 absolute right-[-30px] top-0 md:static">
                          <button onClick={() => removeCustomField(index)} className="text-red-400 hover:text-red-600 transition-colors" title="Remove Field">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="print:hidden flex items-center mt-2 group relative h-4">
                      <input type="checkbox" className="absolute left-0 top-0 cursor-pointer h-4 w-4 z-10 opcaity-0 w-full h-full" checked={showCustomField} onChange={(e) => setShowCustomField(e.target.checked)} title="Hide Custom Fields" />
                      <div className="flex items-center gap-2 text-gray-400 italic pointer-events-none absolute left-0 top-0">
                        <input type="checkbox" className="h-4 w-4" checked={showCustomField} readOnly />
                        <span>Hide All Custom Fields</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="print:hidden flex items-center gap-2 text-gray-400 italic mt-2">
                    <input type="checkbox" className="cursor-pointer h-4 w-4" checked={showCustomField} onChange={(e) => { if (e.target.checked && customFields.length === 0) addCustomField(); setShowCustomField(e.target.checked); }} title="Show Custom Field" />
                    <span>Show Custom Field</span>
                  </div>
                )}

                {showCustomField && (
                  <div className="print:hidden mt-2">
                    <button onClick={addCustomField} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      <Plus size={16} /> Add Custom Field Row
                    </button>
                  </div>
                )}
              </div>


            </div>
            {/* ── TOTALS BOX (Subtotal / Discount / VAT / Grand Total) ──────────
                This is the box on the bottom-right showing financial totals.

                BOX WIDTH:  'w-full md:w-64' → 256px wide on desktop.
                            Change 'w-64' to 'w-72' (288px) or 'w-80' (320px) etc.

                BOX BORDER: 'border-2 border-gray-800'
                            Change 'border-gray-800' to recolor, e.g. 'border-green-800'.

                TOTAL ROW BACKGROUND: class 'bg-green-100'
                TOTAL ROW TEXT COLOR:  class 'text-green-800'
                  → Change both to match your brand, e.g. 'bg-indigo-100' / 'text-indigo-800'

                TOTAL ROW FONT SIZE:  'text-lg' on the grand total amount.
                TEXT LABELS: 'SUBTOTAL', 'DISCOUNT', 'VAT', 'TOTAL PACKAGE'
                  → Simply change the text directly in the JSX below.
            ────────────────────────────────────────────────────────────────── */}
            <div className="w-full md:w-72 shrink-0 flex flex-col relative">
              <div className="border-2 border-gray-800 w-full h-fit">
                <div className="grid grid-cols-2 border-b border-gray-300 p-2 pt-0 pb-3 text-base text-up">
                  <div className="font-bold">SUBTOTAL</div>
                  <div className="flex justify-between items-center font-mono font-bold">
                    <span>SAR</span>
                    <span>{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className={`grid grid-cols-[auto_1fr] md:grid-cols-2 border-b border-gray-300 p-2 pt-0 pb-3 text-base items-center hover:bg-gray-50 transition-colors group ${!discount ? 'print:hidden' : ''}`}>
                  <div className="font-bold flex items-center whitespace-nowrap">DISCOUNT <span className="ml-1 text-xs text-gray-400 font-normal print:hidden">(Edit)</span></div>
                  <div className="flex justify-between items-center font-mono">
                    <span>SAR</span>
                    <input
                      type="number"
                      className="w-full max-w-[100px] text-right outline-none bg-transparent ml-2"
                      value={discount || ''}
                      onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className={`grid grid-cols-[auto_1fr] md:grid-cols-2 border-b border-gray-300 p-2 pt-0 pb-3 text-base items-center hover:bg-gray-50 transition-colors group ${!vatRate ? 'print:hidden' : ''}`}>
                  <div className="font-bold flex items-center whitespace-nowrap">
                    VAT
                    <input
                      type="number"
                      className="w-9 text-center outline-none bg-transparent border-b border-gray-400 mx-1 print:border-none"
                      value={vatRate}
                      onChange={e => setVatRate(parseFloat(e.target.value) || 0)}
                      min="0"
                      max="100"
                    />%
                  </div>
                  <div className="flex justify-between items-center font-mono">
                    <span>SAR</span>
                    <span>{tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 border-gray-300 p-2 pt-0 pb-3 text-base" style={{ backgroundColor: themeColors.totalsBg }}>
                  <div className="font-bold">TOTAL PACKAGE</div>
                  <div className="flex justify-between items-center font-mono font-bold text-md rounded-md bg-green-400 text-black pt-0 pb-3">
                    <span className="mr-2">SAR</span>
                    <span>{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* ── STAMP — adjustable via settings (placed below totals box) ─────────────────────────── */}
              {stampUrl && (
                <div
                  id="stamp-section"
                  style={{
                    display: 'none',
                    transform: `translate(${stampOffsetX}px, ${stampOffsetY}px)`,
                    alignSelf: 'center',
                  }}
                  className="mt-4"
                >
                  <img
                    src={stampUrl}
                    alt="Company Stamp"
                    style={{
                      display: 'block',
                      maxWidth: `${stampSize}px`,
                      maxHeight: `${stampSize}px`,
                      width: 'auto',
                      height: 'auto',
                      opacity: 0.9,
                    }}
                  />
                </div>
              )}

            </div>

          </div>

          {workflowVisibility.preparedBy && (
            <div className="mt-8 flex justify-between items-end border-t border-gray-100 pt-6">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wider">Prepared By:</p>
                {user.role === 'admin' || user.permissions?.canChangeAuthor ? (
                  <select
                    value={authorId || user.id}
                    onChange={(e) => {
                      const newId = Number(e.target.value);
                      setAuthorId(newId);
                      const selectedUser = usersList.find(u => u.id === newId);
                      if (selectedUser) setAuthorName(selectedUser.name || selectedUser.username);
                    }}
                    className="text-lg font-bold text-indigo-700 outline-none bg-transparent border-b border-dashed border-indigo-300 focus:border-indigo-600 print:border-none min-w-[200px]"
                  >
                    {usersList.length > 0 ? usersList.map(u => (
                      <option key={u.id} value={u.id}>{u.name || u.username}</option>
                    )) : (
                      <option value={user.id}>{authorName || user.name || user.username}</option>
                    )}
                  </select>
                ) : (
                  <p className="text-lg font-bold text-indigo-700">{authorName || user.name || user.username}</p>
                )}
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="w-48 border-b-2 border-gray-400 mb-1"></div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Authorized Signature</p>
              </div>
            </div>
          )}

          {/* Share With Panel — independent of Prepared By visibility */}
          {workflowVisibility.shareWith && (user.role === 'admin' || user.permissions?.canShareQuote) && (
            <div className="mt-4 print:hidden border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowSharePanel(p => !p)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  (sharedWith.users.length + sharedWith.groups.length) > 0
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z" /></svg>
                Share With{(sharedWith.users.length + sharedWith.groups.length) > 0 ? ` (${sharedWith.users.length + sharedWith.groups.length})` : ''}
              </button>

              {showSharePanel && (
                <div className="mt-3 p-4 border border-indigo-200 rounded-xl bg-indigo-50 shadow-sm">
                  <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-3">Share this quote with:</p>

                  {/* Groups */}
                  {groupsList.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Groups</p>
                      <div className="flex flex-col gap-2">
                        {groupsList.map(g => {
                          const checked = sharedWith.groups.includes(g.id);
                          const canEdit = sharedWith.canEditGroups.includes(g.id);
                          return (
                            <div key={g.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${
                              checked ? 'bg-white border-indigo-300' : 'bg-white border-gray-200'
                            }`}>
                              <button
                                onClick={() => setSharedWith(prev => ({
                                  ...prev,
                                  groups: checked ? prev.groups.filter(id => id !== g.id) : [...prev.groups, g.id],
                                  canEditGroups: checked ? prev.canEditGroups.filter(id => id !== g.id) : prev.canEditGroups,
                                }))}
                                className={`flex items-center gap-2 text-xs font-semibold transition-colors ${
                                  checked ? 'text-indigo-700' : 'text-gray-400 hover:text-gray-700'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                  checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                                }`}>
                                  {checked && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>}
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4-4a4 4 0 100-8 4 4 0 000 8z" /></svg>
                                {g.name}{g.members.length > 0 ? ` (${g.members.length})` : ''}
                              </button>
                              {checked && (
                                <button
                                  onClick={() => setSharedWith(prev => ({
                                    ...prev,
                                    canEditGroups: canEdit
                                      ? prev.canEditGroups.filter(id => id !== g.id)
                                      : [...prev.canEditGroups, g.id]
                                  }))}
                                  title={canEdit ? 'Can edit — click to make read-only' : 'View only — click to allow editing'}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                                    canEdit
                                      ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                                      : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                  }`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" /></svg>
                                  {canEdit ? 'Can Edit' : 'View Only'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Individual Users */}
                  {usersList.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Individual Users</p>
                      <div className="flex flex-col gap-2">
                        {usersList.filter(u => u.id !== (authorId || user.id)).map(u => {
                          const checked = sharedWith.users.includes(u.id);
                          const canEdit = sharedWith.canEditUsers.includes(u.id);
                          return (
                            <div key={u.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${
                              checked ? 'bg-white border-green-300' : 'bg-white border-gray-200'
                            }`}>
                              <button
                                onClick={() => setSharedWith(prev => ({
                                  ...prev,
                                  users: checked ? prev.users.filter(id => id !== u.id) : [...prev.users, u.id],
                                  canEditUsers: checked ? prev.canEditUsers.filter(id => id !== u.id) : prev.canEditUsers,
                                }))}
                                className={`flex items-center gap-2 text-xs font-semibold transition-colors ${
                                  checked ? 'text-green-800' : 'text-gray-400 hover:text-gray-700'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                  checked ? 'bg-green-600 border-green-600' : 'border-gray-300'
                                }`}>
                                  {checked && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>}
                                </div>
                                <span className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${
                                  checked ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {(u.name || u.username).charAt(0).toUpperCase()}
                                </span>
                                {u.name || u.username}
                              </button>
                              {checked && (
                                <button
                                  onClick={() => setSharedWith(prev => ({
                                    ...prev,
                                    canEditUsers: canEdit
                                      ? prev.canEditUsers.filter(id => id !== u.id)
                                      : [...prev.canEditUsers, u.id]
                                  }))}
                                  title={canEdit ? 'Can edit — click to make read-only' : 'View only — click to allow editing'}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                                    canEdit
                                      ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                                      : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                  }`}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" /></svg>
                                  {canEdit ? 'Can Edit' : 'View Only'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(sharedWith.users.length + sharedWith.groups.length) > 0 && (
                    <button
                      onClick={() => setSharedWith({ users: [], groups: [], canEditUsers: [], canEditGroups: [] })}
                      className="mt-3 text-xs text-red-500 hover:text-red-700 font-medium underline"
                    >
                      Clear all sharing
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-auto">
            {footerImageUrl && (
              <div className="text-center border-t-2 border-gray-800 pt-4 mt-8 flex flex-col gap-2">
                <img src={footerImageUrl} alt="Footer Logo" className="max-w-full h-auto object-contain mx-auto mb-2" style={{ maxHeight: '100px' }} />
              </div>
            )}
          </div>
        </div>

        {/* ── ROW CONTROLS COLUMN (outside the form, aligned to each row) ─── */}
        <div className="shrink-0 print:hidden hidden xl:flex flex-col pt-8">
          {/* Spacer matching formTopHeight + headerHeight to align with first row */}
          <div style={{ height: formTopHeight + headerHeight }}></div>
          {items.map((item, index) => (
            <div
              key={`ctrl-${item.id}`}
              className="flex flex-col items-center justify-center gap-1"
              style={{ height: rowHeights[index] || 40 }}
            >
              <div className="flex flex-col gap-2 transition-opacity">
                <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 transition-colors p-1" title="Remove Item">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── ANALYSIS SIDEBAR (Floating outside the form) ────────────────── */}
        {(() => {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          const canOverride = u.role === 'admin' || !!u.permissions?.canOverridePrice;
          if (!canOverride) return null;

          return (
            <div className="w-[305px] shrink-0 print:hidden hidden xl:flex flex-col pt-8">
              {/* Spacer to align with table headers */}
              <div style={{ height: formTopHeight }} className="flex flex-col justify-end">
                <div className="flex justify-between items-center bg-white border border-gray-200 p-2 rounded-lg shadow-sm z-10 box-border">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-800">M.U. %</span>
                    {priceAlert && (
                      <div
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold animate-pulse flex items-center gap-1 ${priceAlert.type === 'increase' ? 'bg-red-100 text-red-600' :
                          priceAlert.type === 'decrease' ? 'bg-green-100 text-green-600' :
                            'bg-amber-100 text-amber-600'
                          }`}
                        title={`${priceAlert.count} product(s) have updated prices in the database since this quote was created.`}
                      >
                        <AlertTriangle size={10} />
                        {priceAlert.type === 'increase' ? 'COST ↑' : priceAlert.type === 'decrease' ? 'COST ↓' : 'COST ~'}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    value={markup}
                    onChange={e => setMarkup(parseFloat(e.target.value) || 0)}
                    className="w-16 p-1 bg-yellow-300 text-black font-bold outline-none text-center rounded border border-yellow-400"
                  />
                </div>
              </div>

              <div className="border border-gray-800 bg-white shadow-xl rounded-sm">
                <div className={`grid ${developerMode ? 'grid-cols-4' : 'grid-cols-3'} font-bold text-sm text-center border-b-2 border-gray-800 bg-gray-50`} style={{ height: headerHeight }}>
                  {developerMode && <div className="border-r border-gray-800 flex items-center justify-center text-purple-700">RULE</div>}
                  <div className="border-r border-gray-800 flex items-center justify-center">Manual</div>
                  <div className="border-r border-gray-800 flex items-center justify-center">BASE</div>
                  <div className="flex items-center justify-center">TOTAL</div>
                </div>

                <div className="flex flex-col">
                  {items.map((item, index) => {
                    const rule = getItemRule(item);
                    let displayBase = 0;
                    let displayTotal = 0;

                    if (rule === 'EXCL') {
                      displayBase = 0;
                      displayTotal = 0;
                    } else if (rule === 'ZM') {
                      displayBase = item.unit_price || 0;
                      displayTotal = item.net_price || 0;
                    } else {
                      if (rule === 'MAN') displayBase = item.manual_price!;
                      else if (rule === 'DB') displayBase = item.original_price!;
                      displayTotal = displayBase * item.qty;
                    }

                    return (
                      <div key={`side-${item.id}`} className={`grid ${developerMode ? 'grid-cols-4' : 'grid-cols-3'} border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors group`} style={{ height: rowHeights[index] || 40 }}>
                        {developerMode && (
                          <div className="p-1 flex items-center justify-center border-r border-gray-200 font-mono text-[10px] font-bold">
                            {rule === 'EXCL' && <span className="text-red-600 bg-red-100 px-1 py-0.5 rounded">EXCL</span>}
                            {rule === 'ZM' && <span className="text-amber-600 bg-amber-100 px-1 py-0.5 rounded">ZM</span>}
                            {rule === 'MAN' && <span className="text-blue-600 bg-blue-100 px-1 py-0.5 rounded">MAN</span>}
                            {rule === 'DB' && <span className="text-green-600 bg-green-100 px-1 py-0.5 rounded">DB</span>}
                            {rule === '--' && <span className="text-gray-400">--</span>}
                          </div>
                        )}
                        <div className="p-1 flex items-center border-r border-gray-200 relative group/manual">
                          {/* When the item is Excluded or Zero Markup, manually overriding makes no sense. We disable the input. */}
                          {(() => {
                            const isBelowCost = item.manual_price !== undefined && item.original_price !== undefined && item.manual_price < item.original_price;
                            const warnings = [
                              item.costShift === 'up' ? 'Cost INCREASED in database.' : item.costShift === 'down' ? 'Cost DECREASED in database.' : '',
                              isBelowCost ? 'SELLING BELOW COST!' : ''
                            ].filter(Boolean);
                            const tooltip = warnings.join(' ');

                            return (
                              <input
                                type="number"
                                disabled={rule === 'EXCL' || rule === 'ZM'}
                                title={tooltip}
                                className={`w-full h-full text-center outline-none bg-transparent ${isBelowCost ? 'text-red-600 font-bold' : ''} ${item.costShift ? 'bg-amber-50/50' : ''} disabled:opacity-30 disabled:cursor-not-allowed`}
                                value={item.manual_price !== undefined ? item.manual_price : ''}
                                onChange={e => {
                                  if (e.target.value === '') updateItem(index, 'manual_price', undefined);
                                  else updateItem(index, 'manual_price', parseFloat(e.target.value));
                                }}
                              />
                            );
                          })()}
                        </div>
                        <div className="p-1 flex items-center justify-center text-[13px] border-r border-gray-200 uppercase font-mono">
                          {rule === 'EXCL' ? '-' : displayBase.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="p-1 flex items-center justify-center text-[13px] font-mono">
                          {rule === 'EXCL' ? '-' : displayTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 p-1 font-bold text-base mt-4 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                <div className="flex justify-between items-center px-1">
                  <span className="text-gray-600">B.Total</span>
                  <span className="font-mono">{baseTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center px-1 bg-green-50 rounded">
                  <span className="text-green-800">MU</span>
                  <span className="font-mono text-green-700">{markupProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="grid grid-cols-2 mt-2 border-2 border-gray-800 rounded overflow-hidden shadow-sm">
                  <div className="bg-white px-2 py-1 flex items-center border-r border-gray-800 text-lg">TTL PROFIT</div>
                  <div className="bg-yellow-400 px-2 py-1 flex items-center justify-center font-mono text-lg">
                    {markupProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Overwrite Confirmation Modal */}
        {showOverwriteModal && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center print:hidden">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Quote ID Exists</h3>
              <p className="text-gray-600 mb-6">A quote with ID <span className="font-bold">{quoteId}</span> already exists. How would you like to proceed?</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => performSave(true)}
                  className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  Overwrite Existing Quote ({quoteId})
                </button>
                <button
                  onClick={handleCreateNewId}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  Generate New ID & Save
                </button>
                <button
                  onClick={() => setShowOverwriteModal(false)}
                  className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Version Conflict Modal */}
        {showConflictModal && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center print:hidden">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Version Conflict</h3>
              <p className="text-gray-600 mb-6">The server has a newer version of this quote. Another user may have modified it since you opened it.</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowConflictModal(false)}
                  className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors border border-gray-300"
                >
                  Cancel (Review my changes)
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-2 px-4 bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium rounded-lg transition-colors"
                >
                  Reload from Server (Discard mine)
                </button>
                <button
                  onClick={() => {
                    setShowConflictModal(false);
                    handleCreateRevision();
                  }}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  Save as New Revision
                </button>
                <button
                  onClick={() => performSave(true)}
                  className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  Force Overwrite Server Version
                </button>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Save Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center print:hidden">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Save Terms as Template</h3>
            <p className="text-gray-600 mb-4 text-sm">Save the current Note, Payment, Warranty, Duration, Mobilization, Manpower, Bank Details, and Footer as a reusable template.</p>
            <input
              type="text"
              autoFocus
              placeholder="E.g., Standard CCTV Terms"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 mb-6"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveTemplate()}
            />
            <div className="flex justify-end gap-3 font-medium">
              <button
                className="px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700"
                onClick={() => setShowTemplateModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                onClick={saveTemplate}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Datalist for Unit Suggestions */}
      <datalist id="unit-suggestions">
        {UNIT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
      </datalist>

      {/* ── Add Product Modal ────────────────────────────────────────────── */}
      {addProductModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center print:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-white" />
                <h2 className="text-white font-bold text-base">Add to Product DB</h2>
              </div>
              <button onClick={() => setAddProductModal(null)} className="text-white/70 hover:text-white text-xl leading-none">&times;</button>
            </div>
            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Product Name</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={addProductModal.description}
                  onChange={e => setAddProductModal(m => m ? { ...m, description: e.target.value } : m)}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Unit</label>
                  <input
                    type="text"
                    list="unit-suggestions"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={addProductModal.unit}
                    onChange={e => setAddProductModal(m => m ? { ...m, unit: e.target.value } : m)}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Unit Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={addProductModal.price}
                    onChange={e => setAddProductModal(m => m ? { ...m, price: e.target.value } : m)}
                  />
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-gray-50">
              <button
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                onClick={() => setAddProductModal(null)}
              >Cancel</button>
              <button
                disabled={addProductModal.isSaving}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center gap-2"
                onClick={async () => {
                  const { rowIndex, description, unit, price } = addProductModal;
                  const unit_price = parseFloat(price) || 0;
                  if (!description.trim()) return;

                  setAddProductModal(m => m ? { ...m, isSaving: true } : m);

                  try {
                    // Pre-translate before saving to DB
                    let description_ar = '';
                    const trans = await translateSingle(description.trim());
                    if (trans) description_ar = trans;

                    const res = await fetch('/api/products', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        description: description.trim(),
                        description_ar,
                        unit: unit || 'Pc',
                        unit_price
                      }),
                    });
                    if (res.ok) {
                      const { id } = await res.json();
                      const refreshed = await fetch(`/api/products?_t=${Date.now()}`);
                      if (refreshed.ok) {
                        const data = await refreshed.json();
                        if (Array.isArray(data)) {
                          setProducts(data);
                          const newProd = data.find((p: any) => p.id === id);
                          if (newProd) {
                            setItems(prev => {
                              const next = [...prev];
                              const calcPrice = newProd.unit_price * (1 + markup / 100);
                              next[rowIndex] = {
                                ...next[rowIndex],
                                product_id: newProd.id,
                                original_price: newProd.unit_price,
                                description: newProd.description,
                                description_ar: newProd.description_ar || '',
                                unit: newProd.unit,
                                unit_price: calcPrice,
                                net_price: next[rowIndex].qty * calcPrice,
                              };
                              return next;
                            });
                          }
                        }
                      }
                      setAddProductModal(null);
                    } else {
                      setAddProductModal(m => m ? { ...m, isSaving: false } : m);
                    }
                  } catch (e) {
                    console.error('Failed to add product:', e);
                    setAddProductModal(m => m ? { ...m, isSaving: false } : m);
                  }
                }}
              >
                {addProductModal.isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Saving...
                  </>
                ) : 'Save & Add to Quote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Customer Modal ────────────────────────────────────────────── */}
      {addCustomerModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center print:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-white" />
                <h2 className="text-white font-bold text-base">Add to Customer DB</h2>
              </div>
              <button onClick={() => setAddCustomerModal(null)} className="text-white/70 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Customer Name</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-sm"
                  value={addCustomerModal.name}
                  onChange={e => setAddCustomerModal({ ...addCustomerModal, name: e.target.value })}
                  placeholder="Company or Individual Name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Mobile</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-sm"
                    value={addCustomerModal.mobile}
                    onChange={e => setAddCustomerModal({ ...addCustomerModal, mobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Contact Person</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-sm"
                    value={addCustomerModal.contact}
                    onChange={e => setAddCustomerModal({ ...addCustomerModal, contact: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-sm"
                  value={addCustomerModal.email}
                  onChange={e => setAddCustomerModal({ ...addCustomerModal, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Address</label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-sm"
                  value={addCustomerModal.address}
                  onChange={e => setAddCustomerModal({ ...addCustomerModal, address: e.target.value })}
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setAddCustomerModal(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-bold flex items-center gap-2"
                disabled={addCustomerModal.isSaving}
                onClick={async () => {
                  if (!addCustomerModal.name.trim()) return alert('Name is required');
                  setAddCustomerModal(m => m ? { ...m, isSaving: true } : m);
                  try {
                    const res = await fetch('/api/customers', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: addCustomerModal.name.trim(),
                        mobile: addCustomerModal.mobile,
                        address: addCustomerModal.address,
                        contact: addCustomerModal.contact,
                        email: addCustomerModal.email
                      }),
                    });
                    if (res.ok) {
                      const { id } = await res.json();
                      const refreshed = await fetch(`/api/customers?_t=${Date.now()}`);
                      if (refreshed.ok) {
                        const data = await refreshed.json();
                        if (Array.isArray(data)) {
                          setCustomers(data);
                          const newCust = data.find((c: any) => c.id === id);
                          if (newCust) {
                            setSelectedCustomerId(newCust.id);
                            setSelectedCustomer(newCust);
                            setCustomerSearch(newCust.name);
                          }
                        }
                      }
                      setAddCustomerModal(null);
                    } else {
                      setAddCustomerModal(m => m ? { ...m, isSaving: false } : m);
                    }
                  } catch (e) {
                    setAddCustomerModal(m => m ? { ...m, isSaving: false } : m);
                  }
                }}
              >
                {addCustomerModal.isSaving ? 'Saving...' : 'Save & Select'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
