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
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Save, Printer, RefreshCw, Download, FileSpreadsheet, Send, Loader2, ArrowUp, ArrowDown, Copy, Bookmark, BookOpen, Languages, ChevronDown, Search } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx-js-style';

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
}

interface CustomField {
  id: string;
  header: string;
  value: string;
  valueAr: string;
}

export default function QuoteForm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const recallQuoteId = searchParams.get('recall');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [footerImageUrl, setFooterImageUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // ── SIDEBAR ALIGNMENT REFS ──────────────────────────────────────────────
  // printRef wraps the actual document. formTopRef wraps the header section
  // up to the items table. This allows the Analysis Sidebar (which sits 
  // outside the form) to align its table header perfectly with the 
  // document's items table.
  const printRef = useRef<HTMLDivElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);
  const [formTopHeight, setFormTopHeight] = useState<number>(0);
  // logoSize is loaded from the Admin Settings page (Settings → Logo Size).
  // The number maps to a Tailwind spacing unit: 24 = h-24 = 6rem ≈ 96px tall.
  // You can change the default here, but it will be overridden by whatever is
  // saved in the database via the Settings page.
  const [logoSize, setLogoSize] = useState(24);
  const [themeColors, setThemeColors] = useState<ThemeColors>({
    headerBg: "#dcfce7",
    headerText: "#1f2937",
    stripeBg: "#f9fafb",
    totalsBg: "#f3f4f6"
  });

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
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [focusedDescriptionIndex, setFocusedDescriptionIndex] = useState<number | null>(null);

  const [subject, setSubject] = useState('');
  const [subjectAr, setSubjectAr] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [status, setStatus] = useState('Draft');
  const [type, setType] = useState('Quotation');

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
      if (item.manual_price !== undefined || item.original_price === undefined) {
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
    setCustomFields([...customFields, { id: crypto.randomUUID(), header: 'CUSTOM FIELD:', value: '', valueAr: '' }]);
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

  useEffect(() => {
    const init = async () => {
      const dbCustomers = await fetchCustomers();
      const dbProducts = await fetchProducts();
      fetchLogo();
      loadTemplates();
      if (recallQuoteId) {
        fetchQuote(recallQuoteId, dbCustomers, dbProducts);
      } else if (!quoteId) {
        // Check for saved draft
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) setDraftBanner(true);
        generateQuoteId();
        setItems([{ id: crypto.randomUUID(), description: '', description_ar: '', qty: 1, unit: 'set', unit_price: 0, net_price: 0 }]);
      }
    };
    init();
  }, [recallQuoteId]);

  const fetchCustomers = async () => {
    const res = await fetch('/api/customers');
    const data = await res.json();
    setCustomers(data);
    return data;
  };

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
    return data;
  };

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

    } catch (e) {
      console.error('Failed to fetch settings', e);
    }
  };

  const handleAutoTranslate = async (text: string, currentAr: string, setterAr: (val: string) => void, force = false) => {
    if (!text) return;
    if (currentAr && !force) return; // Only auto-translate if empty or forced
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
    const isConfirm = confirm('This will translate all empty Arabic fields based on English content. Proceed?');
    if (!isConfirm) return;

    // 1. Subject
    if (subject && !subjectAr) {
      const trans = await translateSingle(subject);
      if (trans) setSubjectAr(trans);
    }

    // 2. Items
    const newItems = [...items];
    let itemsChanged = false;
    for (let i = 0; i < newItems.length; i++) {
      if (newItems[i].description && !newItems[i].description_ar) {
        const trans = await translateSingle(newItems[i].description);
        if (trans) {
          newItems[i].description_ar = trans;
          itemsChanged = true;
        }
      }
    }
    if (itemsChanged) setItems(newItems);

    // 3. Terms
    if (note && !noteAr) {
      const trans = await translateSingle(note);
      if (trans) setNoteAr(trans);
    }
    if (payment && !paymentAr) {
      const trans = await translateSingle(payment);
      if (trans) setPaymentAr(trans);
    }
    if (warranty && !warrantyAr) {
      const trans = await translateSingle(warranty);
      if (trans) setWarrantyAr(trans);
    }
    if (manpower && !manpowerAr) {
      const trans = await translateSingle(manpower);
      if (trans) setManpowerAr(trans);
    }
    if (mobilization && !mobilizationAr) {
      const trans = await translateSingle(mobilization);
      if (trans) setMobilizationAr(trans);
    }
    if (duration && !durationAr) {
      const trans = await translateSingle(duration);
      if (trans) setDurationAr(trans);
    }
    if (bankDetails && !bankDetailsAr) {
      const trans = await translateSingle(bankDetails);
      if (trans) setBankDetailsAr(trans);
    }

    // 4. Custom Fields
    const newCFs = [...customFields];
    let cfChanged = false;
    for (let i = 0; i < newCFs.length; i++) {
      if (newCFs[i].value && !newCFs[i].valueAr) {
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

  const handleProductAutoTranslate = async (index: number, text: string, currentAr: string, force = false) => {
    if (!text) return;
    if (currentAr && !force) return; // Only auto-translate if empty or forced
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation) updateItem(index, 'description_ar', data.translation);
      }
    } catch (e) {
      console.error('Translation failed', e);
    }
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
      setQuoteId(data.quote_id);
      setDate(data.date);
      setExpiryDate(data.expiry_date || '');
      setSelectedCustomerId(data.customer_id || '');
      // Update search field if customer found
      const c = customersList.find(cust => cust.id === data.customer_id);
      if (c) {
        setSelectedCustomer(c);
        setCustomerSearch(c.name);
      }
      setSubject(data.subject || '');
      setSubjectAr(data.subject_ar || '');
      setNoteHeader(data.note_header || 'NOTE:');
      setNoteHeader(data.note_header || 'NOTE:');
      setNote(data.note || 'Any additional work|device will be considered Change Order\nInternet source is provided by the OWNER');
      setNoteAr(data.note_ar || 'سيتم اعتبار أي عمل إضافي | جهاز بمثابة أمر تغيير\nيتم توفير مصدر الإنترنت من قبل المالك');
      setDiscount(data.discount || 0);
      setStatus(data.status || 'Draft');
      setType(data.type || 'Quotation');
      setVatRate(data.vat_rate !== undefined ? data.vat_rate : 15);
      setMarkup(data.markup !== undefined ? data.markup : 8);
      setPayment(data.payment || 'Full Payment in ADVANCE');
      setPaymentAr(data.payment_ar || 'الدفع الكامل مقدما');
      setWarranty(data.warranty || "2 YEARS limited warranty and/or supplier's recommendation");
      setWarrantyAr(data.warranty_ar || 'ضمان محدود لمدة عامين و/أو توصية المورد');
      setManpower(data.manpower || '2 Technicians, 1 Supervisor');
      setManpowerAr(data.manpower_ar || 'فنيين، 1 مشرف 2');
      setMobilization(data.mobilization || '3-4 days upon confirmation of payment');
      setMobilizationAr(data.mobilization_ar || 'أيام بعد تأكيد الدفع 4-3');
      setDuration(data.duration || '1-2 Working Days');
      setDurationAr(data.duration_ar || 'أيام عمل 2-1');
      setBankDetails(data.bank_details || 'ALINMA BANK - Account: 68206662020000\nIBAN: SA0305000068206662020000 ABDULMOSHIN\nABDULAZIZ AL-JABR TRADING CO.');
      setBankDetailsAr(data.bank_details_ar || 'بنك الإنماء - الحساب: 68206662020000\nالأيبان: SA0305000068206662020000 عبدالمحسن\nعبدالعزيز الجبر للتجارة');
      setFooter(data.footer || 'Thank you for your business!');
      setFooterAr(data.footer_ar || 'شكرا لتعاملكم معنا!');

      let parsedCustomFields: CustomField[] = [];
      if (data.custom_field) {
        try {
          const parsed = JSON.parse(data.custom_field);
          if (Array.isArray(parsed)) {
            parsedCustomFields = parsed;
          } else {
            parsedCustomFields = [{
              id: crypto.randomUUID(),
              header: data.custom_field_header || 'CUSTOM FIELD:',
              value: data.custom_field || '',
              valueAr: data.custom_field_ar || ''
            }];
          }
        } catch (e) {
          parsedCustomFields = [{
            id: crypto.randomUUID(),
            header: data.custom_field_header || 'CUSTOM FIELD:',
            value: data.custom_field || '',
            valueAr: data.custom_field_ar || ''
          }];
        }
      }
      setCustomFields(parsedCustomFields);
      setShowCustomField(parsedCustomFields.length > 0);

      setItems(data.items.map((item: any) => {
        // Fallback: if original_price is null (missing from DB for old quotes), 
        // try to find the current product's original price.
        let original_price = item.original_price;
        if ((original_price === null || original_price === undefined) && item.product_id) {
          const prod = productsList.find(p => p.id === item.product_id);
          if (prod) original_price = prod.unit_price;
        }

        return {
          ...item,
          id: crypto.randomUUID(),
          original_price: original_price,
          manual_price: item.manual_price
        };
      }));
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
    setItems([{ id: crypto.randomUUID(), description: '', description_ar: '', qty: 1, unit: 'set', unit_price: 0, net_price: 0 }]);
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

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], [field]: value };

      if (field === 'manual_price') {
        if (value !== undefined && value !== null && value !== '' && !isNaN(value)) {
          newItems[index].unit_price = value;
        } else {
          const orig = newItems[index].original_price;
          newItems[index].unit_price = orig !== undefined ? orig * (1 + markup / 100) : 0;
          newItems[index].manual_price = undefined;
        }
      } else if (field === 'unit_price') {
        newItems[index].manual_price = value === '' || isNaN(value) ? undefined : value;
      }

      if (field === 'qty' || field === 'unit_price' || field === 'manual_price') {
        newItems[index].net_price = newItems[index].qty * newItems[index].unit_price;
      }
      return newItems;
    });
  };

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), description: '', description_ar: '', qty: 1, unit: 'set', unit_price: 0, net_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (!window.confirm('Are you sure you want to remove this item?')) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems.length ? newItems : [{ id: crypto.randomUUID(), description: '', description_ar: '', qty: 1, unit: 'set', unit_price: 0, net_price: 0 }]);
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

  const subtotal = items.reduce((sum, item) => sum + (item.net_price || 0), 0);
  const baseTotal = items.reduce((sum, item) => sum + ((item.original_price || 0) * item.qty), 0);
  const markupProfit = subtotal - baseTotal;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = discountedSubtotal * (vatRate / 100);
  const grandTotal = discountedSubtotal + tax;

  const performSave = async () => {
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
      }))
    };

    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert(recallQuoteId === quoteId ? 'Quote updated successfully!' : 'Quote data is recorded to Tracking section!');
      localStorage.removeItem('quote_draft'); // clear auto-saved draft on successful record
      setShowOverwriteModal(false);
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

  // ── DRAFT AUTO-SAVE: write every 30 seconds ────────────────────────────────
  useEffect(() => {
    if (recallQuoteId) return; // Don't auto-save when editing a recalled quote
    const save = () => {
      if (!quoteId && items.every(i => !i.description)) return; // Nothing worth saving
      const draft = {
        quoteId, date, expiryDate, subject, subjectAr, items, discount, vatRate,
        selectedCustomerId, selectedCustomer, customerSearch,
        note, noteAr, noteHeader, payment, paymentAr, warranty, warrantyAr,
        manpower, manpowerAr, mobilization, mobilizationAr, duration, durationAr,
        bankDetails, bankDetailsAr, footer, footerAr, customFields,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
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

          clonedDoc.querySelectorAll('.min-w-\\[900px\\]').forEach((el: any) => {
            el.classList.remove('min-w-[900px]');
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
      const imgData = canvas.toDataURL('image/png', 1);
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

      while (heightLeft > 0) {
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

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

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
      ['ITEM', 'DESCRIPTION', 'DESCRIPTION (ARABIC)', 'QTY', 'UNIT', 'UNIT PRICE', 'NET PRICE'],
      ...items.map((item, index) => [
        index + 1,
        item.description,
        item.description_ar || '',
        item.qty,
        item.unit,
        `SAR ${item.unit_price.toFixed(2)}`,
        `SAR ${item.net_price.toFixed(2)}`
      ]),
      ['', '', '', '', '', 'SUBTOTAL', `SAR ${subtotal.toFixed(2)}`],
      ['', '', '', '', '', 'DISCOUNT', `SAR ${discount.toFixed(2)}`],
      ['', '', '', '', '', 'VAT (15%)', `SAR ${tax.toFixed(2)}`],
      ['', '', '', '', '', 'TOTAL PACKAGE', `SAR ${grandTotal.toFixed(2)}`],
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

    const ws = XLSX.utils.aoa_to_sheet([...quoteInfo, ...itemsData]);

    // Improve Excel formatting with column widths
    ws['!cols'] = [
      { wch: 15 }, // A: ITEM / INFO Labels
      { wch: 50 }, // B: DESCRIPTION / INFO Values
      { wch: 50 }, // C: DESCRIPTION (ARABIC)
      { wch: 10 }, // D: QTY
      { wch: 10 }, // E: UNIT
      { wch: 15 }, // F: UNIT PRICE
      { wch: 15 }  // G: NET PRICE
    ];

    // Apply basic borders and styling to all cells
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cellRef]) continue;

        let bold = false;
        if (R === 0 || ws[cellRef].v === 'CUSTOMER INFO' || ws[cellRef].v === 'TERMS & CONDITIONS' || ws[cellRef].v === 'ITEM' || ws[cellRef].v === 'DESCRIPTION') {
          bold = true;
        }

        ws[cellRef].s = {
          border: {
            top: { style: 'thin', color: { auto: 1 } },
            bottom: { style: 'thin', color: { auto: 1 } },
            left: { style: 'thin', color: { auto: 1 } },
            right: { style: 'thin', color: { auto: 1 } }
          },
          font: { name: 'Arial', sz: 10, bold },
          alignment: { vertical: 'center', wrapText: true }
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Quote');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;

    // ── EXCEL FILENAME ──────────────────────────────────────────────────────────
    // Same naming convention as the PDF export above.
    // Format: CustomerName-QuoteID.xlsx
    // To customise, follow the same pattern described in the PDF filename block.
    const excelCustomerName = (selectedCustomer?.name || 'Unknown')
      .replace(/[^a-zA-Z0-9_\-.\s]/g, '') // strip filename-unsafe characters
      .trim();
    link.download = `${excelCustomerName}-${quoteId}.xlsx`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="space-y-6">
      {/* ── ACTION BAR ── Hidden when printing/exporting PDF ─────────────────
          This bar contains all the action buttons: Clear, Record, Email, Print,
          Export Excel, Export PDF. It is NOT shown in the printed/PDF output.

          BUTTON COLOR GUIDE (change the bg-* and hover:bg-* class to recolor):
            Clear           → bg-gray-100  hover:bg-gray-200  (light gray)
            Record          → bg-indigo-600 hover:bg-indigo-700 (blue-purple)
            Create Revision → bg-orange-500 hover:bg-orange-600 (orange)
            To Invoice      → bg-purple-600 hover:bg-purple-700 (purple)
            Email           → bg-sky-500   hover:bg-sky-600    (light blue)
            Print           → bg-emerald-600 hover:bg-emerald-700 (teal-green)
            Export Excel    → bg-green-600 hover:bg-green-700  (green)
            Export PDF      → bg-blue-600  hover:bg-blue-700   (blue)

          Color names reference: gray, red, orange, amber, yellow, lime, green,
          emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink.
          Number suffix controls darkness: 50 (lightest) → 950 (darkest).
      ────────────────────────────────────────────────────────────────────── */}
      {/* ── DRAFT RESTORE BANNER ────────────────────────────────────────────────────── */}
      {draftBanner && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 print:hidden">
          <span className="text-amber-800 text-sm font-medium">📝 You have an unsaved draft from a previous session.</span>
          <div className="flex gap-2">
            <button onClick={restoreDraft} className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium">Restore Draft</button>
            <button onClick={discardDraft} className="px-3 py-1.5 text-sm bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors">Discard</button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 print:hidden gap-4">
        <h2 className="text-xl font-bold text-gray-800 w-full md:w-auto text-center md:text-left">Quote Generator</h2>
        <div className="flex flex-wrap justify-center md:justify-end gap-2 md:gap-3 w-full md:w-auto">
          <button onClick={clearForm} className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            <RefreshCw size={18} /> Clear
          </button>
          <button onClick={recordQuote} className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
            <Save size={18} /> Record
          </button>
          <button onClick={handleTranslateAll} className="flex items-center gap-2 px-4 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors" title="Translate all empty Arabic fields">
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
              {type !== 'Tax Invoice' && (
                <button onClick={handleConvertToInvoice} className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors" title="Switch type to Tax Invoice">
                  To Invoice
                </button>
              )}
            </>
          )}
          {/* ── TEMPLATE BUTTONS ───────────────────────────────────────────────────── */}
          <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-2 px-4 py-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors" title="Save current Terms as a reusable template">
            <Bookmark size={18} /> Save Template
          </button>
          {templates.length > 0 && (
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
                <BookOpen size={18} /> Load Template ▾
              </button>
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[180px] hidden group-hover:block">
                {templates.map(t => (
                  <div key={t.name} className="flex items-center hover:bg-amber-50 group/item">
                    <button onClick={() => applyTemplate(t)} className="flex-1 text-left px-4 py-2 text-sm text-gray-700">
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
          <button onClick={handleSendEmail} disabled={isSending} className="flex items-center gap-2 px-4 py-2 text-white bg-sky-500 hover:bg-sky-600 rounded-lg transition-colors disabled:opacity-50">
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Email
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
            <Printer size={18} /> Print
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
            <FileSpreadsheet size={18} /> Export Excel
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Download size={18} /> Export PDF
          </button>
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
              <select value={type} onChange={(e) => setType(e.target.value)} className="bg-transparent border-b border-gray-300 outline-none font-medium py-1">
                <option value="Quotation">Quotation</option>
                <option value="Tax Invoice">Tax Invoice</option>
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
            <div className="bg-gray-100 px-4 pt-0 pb-3 border-b-2 border-gray-800 font-bold text-lg">
              CUSTOMER INFO
            </div>
            <div className="px-4 py-2 grid grid-cols-[100px_1fr_100px_1fr] gap-y-0.5 text-base items-center">
              <span className="font-bold flex items-center">Customer:</span>
              <div className="relative w-full z-50 flex items-center">
                <input
                  type="text"
                  className="w-full p-1 border border-gray-300 rounded outline-none focus:border-indigo-500 print:appearance-none print:border-none print:bg-transparent"
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
                    className="flex-1 py-1.5 px-2 outline-none bg-transparent"
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
          <div className="w-full border-2 border-gray-800 min-w-0 mb-6" style={{ marginTop: '0px', borderColor: '#1f2937' }}>
              <div className="overflow-x-auto overflow-y-visible print:overflow-visible">
                <div className={`min-w-[900px] print:min-w-0 transition-all ${focusedDescriptionIndex !== null ? 'pb-48' : ''}`}>
                  {/* ── TABLE HEADER ROW ──────────────────────────────────────────
                    backgroundColor: '#dcfce7' = light green — change to recolor.
                    borderColor:     '#1f2937' = dark gray   — change to recolor.
                */}
                  <div
                    ref={headerRef}
                    className="grid grid-cols-[44px_1fr_64px_64px_110px_110px_36px] border-b-2 font-bold text-base text-center print:grid-cols-[44px_1fr_64px_64px_110px_110px]"
                    style={{ backgroundColor: themeColors.headerBg, color: themeColors.headerText, borderColor: '#1f2937' }}
                  >
                    <div className="py-2 px-1 border-r border-gray-800 h-full">ITEM</div>
                    <div className="py-2 px-2 border-r border-gray-800 h-full">
                      DESCRIPTION
                    </div>
                    <div className="py-2 px-1 border-r border-gray-800 h-full">QTY</div>
                    <div className="py-2 px-1 border-r border-gray-800 h-full">UNIT</div>
                    <div className="py-2 px-2 border-r border-gray-800 h-full">UNIT PRICE</div>
                    <div className="py-2 px-2 h-full">NET PRICE</div>
                    <div className="py-2 px-1 print:hidden"></div>
                  </div>
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      ref={el => rowRefs.current[index] = el}
                      className={`grid grid-cols-[44px_1fr_64px_64px_110px_110px_36px] border-b border-gray-300 last:border-b-0 text-base items-start group print:grid-cols-[44px_1fr_64px_64px_110px_110px] ${focusedDescriptionIndex === index ? 'relative z-50' : 'relative z-0'}`} style={{ backgroundColor: index % 2 === 0 ? themeColors.stripeBg : 'transparent' }}>
                      <div className="px-1 py-0.5 text-center border-r border-gray-300 h-full flex flex-col items-center justify-start pt-1">
                        {index + 1}
                        {(item.unit_price === 0 || (item.original_price !== undefined && item.unit_price < item.original_price)) && (
                          <span className="print:hidden mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold" title={item.unit_price === 0 ? 'Price is 0!' : `Below DB price (${item.original_price})`}>!</span>
                        )}
                      </div>
                      <div className="p-0 border-r border-gray-300 h-full flex relative group">
                        <div className="px-2 py-0.5 w-1/2 flex flex-col justify-center relative">
                          <textarea
                            className="w-full outline-none bg-transparent resize-none overflow-hidden min-h-[24px] relative z-0"
                            value={item.description}
                            placeholder="Type to search product..."
                            onChange={e => updateItem(index, 'description', e.target.value)}
                            onFocus={() => setFocusedDescriptionIndex(index)}
                            onBlur={() => {
                              setTimeout(() => setFocusedDescriptionIndex(null), 200);
                              handleProductAutoTranslate(index, item.description, item.description_ar || '');
                            }}
                            rows={item.description.split('\n').length || 1}
                          />

                          {focusedDescriptionIndex === index && item.description.length > 1 && (
                            <div className="absolute top-full left-0 z-50 w-[200%] mt-1 bg-white border border-gray-200 rounded shadow-xl max-h-48 overflow-y-auto print:hidden">
                              {products
                                .filter(p => p.description.toLowerCase().includes(item.description.toLowerCase()) && p.description.toLowerCase() !== item.description.toLowerCase())
                                .map(p => (
                                  <div
                                    key={p.id}
                                    className="px-3 py-2 text-sm hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0"
                                    onClick={() => {
                                      handleProductSelect(index, p.id.toString());
                                      setFocusedDescriptionIndex(null);
                                      handleProductAutoTranslate(index, p.description, '');
                                    }}
                                  >
                                    <div className="font-medium">{p.description}</div>
                                    {p.description_ar && <div className="text-xs text-gray-500 text-right" dir="rtl">{p.description_ar}</div>}
                                  </div>
                                ))}
                            </div>
                          )}
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
                        </div>
                        <div className="w-px bg-gray-200 print:hidden shrink-0 my-1"></div>
                        <div className="px-2 py-0.5 w-1/2 flex flex-col justify-center">
                          <textarea
                            dir="rtl"
                            className="w-full outline-none bg-transparent resize-none overflow-hidden text-right min-h-[24px]"
                            value={item.description_ar || ''}
                            onChange={e => updateItem(index, 'description_ar', e.target.value)}
                            placeholder="الوصف بالعربية..."
                            rows={(item.description_ar || '').split('\n').length || 1}
                          />
                        </div>
                      </div>
                      <div className="px-1 py-0.5 border-r border-gray-300 h-full flex items-center">
                        <input
                          type="number"
                          className="w-full text-center text-base outline-none bg-transparent"
                          value={item.qty || ''}
                          onChange={e => updateItem(index, 'qty', parseFloat(e.target.value) || 0)}
                          min="1"
                        />
                      </div>
                      <div className="px-1 py-0.5 border-r border-gray-300 h-full flex items-center">
                        <input
                          type="text"
                          list="unit-suggestions"
                          className="w-full text-center text-base outline-none bg-transparent"
                          value={item.unit}
                          onChange={e => updateItem(index, 'unit', e.target.value)}
                        />
                      </div>
                      <div className={`px-2 py-0.5 border-r border-gray-300 h-full flex items-center font-mono text-base ${item.unit_price === 0 || (item.original_price !== undefined && item.unit_price < item.original_price) ? 'text-amber-600' : ''}`}>
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
                      <div className={`px-2 py-0.5 font-mono font-medium text-base h-full flex items-center justify-center ${item.unit_price === 0 ? 'text-amber-600' : ''}`}>
                        <span className="w-full text-center">{item.net_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="px-1 py-0.5 text-center print:hidden flex flex-col items-center justify-start pt-1 gap-1 h-full">
                        <button onClick={() => moveItemUp(index)} disabled={index === 0} className="text-gray-400 hover:text-indigo-600 disabled:opacity-0 transition-colors" title="Move Up">
                          <ArrowUp size={12} />
                        </button>
                        <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 transition-colors" title="Remove Item">
                          <Trash2 size={14} />
                        </button>
                        <button onClick={() => moveItemDown(index)} disabled={index === items.length - 1} className="text-gray-400 hover:text-indigo-600 disabled:opacity-0 transition-colors" title="Move Down">
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="p-2 bg-gray-50 border-t border-gray-300 print:hidden">
                    <button onClick={addItem} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      <Plus size={16} /> Add Row
                    </button>
                  </div>
                </div>
              </div>
            </div>

          {/* Bottom Section: Terms & Totals */}
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-4">
            {/* Terms & Conditions */}
            {/* Terms & Conditions */}
            <div className="flex-1 space-y-2 text-sm">
              {showNote && (
                <div className="flex flex-col md:flex-row gap-2 group relative">
                  <span className="font-bold w-32 shrink-0">
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
                    <span className="font-bold w-32 shrink-0">PAYMENT:</span>
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
                    <span className="font-bold w-32 shrink-0">WARRANTY:</span>
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
                    <span className="font-bold w-32 shrink-0">MANPOWER:</span>
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
                    <span className="font-bold w-32 shrink-0">MOBILIZATION:</span>
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
                    <span className="font-bold w-32 shrink-0">DURATION:</span>
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
                    <span className="font-bold w-32 shrink-0 mt-1">BANK DETAILS:</span>
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
                        <span className="font-bold w-32 shrink-0">
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
            <div className="w-full md:w-72 border-2 border-gray-800 shrink-0 h-fit">
              <div className="grid grid-cols-2 border-b border-gray-300 p-2 text-base">
                <div className="font-bold">SUBTOTAL</div>
                <div className="flex justify-between items-center font-mono">
                  <span>SAR</span>
                  <span>{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className={`grid grid-cols-[auto_1fr] md:grid-cols-2 border-b border-gray-300 p-2 text-base items-center hover:bg-gray-50 transition-colors group ${!discount ? 'print:hidden' : ''}`}>
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
              <div className={`grid grid-cols-[auto_1fr] md:grid-cols-2 border-b border-gray-300 p-2 text-base items-center hover:bg-gray-50 transition-colors group ${!vatRate ? 'print:hidden' : ''}`}>
                <div className="font-bold flex items-center whitespace-nowrap">
                  VAT
                  <input
                    type="number"
                    className="w-12 text-center outline-none bg-transparent border-b border-gray-400 mx-1 print:border-none"
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
              <div className="grid grid-cols-2 p-2 text-base" style={{ backgroundColor: themeColors.totalsBg }}>
                <div className="font-bold">TOTAL PACKAGE</div>
                <div className="flex justify-between items-center font-mono font-bold text-lg bg-green-300 text-black px-0 py-1 rounded-lg">
                  <span className="mr-2">SAR</span>
                  <span>{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-auto">
            {footerImageUrl && (
              <div className="text-center border-t-2 border-gray-800 pt-4 mt-8 flex flex-col gap-2">
                <img src={footerImageUrl} alt="Footer Logo" className="max-w-full h-auto object-contain mx-auto mb-2" style={{ maxHeight: '100px' }} />
              </div>
            )}
          </div>
        </div>

        {/* ── ANALYSIS SIDEBAR (Floating outside the form) ────────────────── */}
        <div className="w-[305px] shrink-0 print:hidden hidden xl:flex flex-col pt-8">
          {/* Spacer to align with table headers */}
          <div style={{ height: formTopHeight }} className="flex flex-col justify-end">
             <div className="flex justify-between items-center bg-white border border-gray-200 p-2 rounded-lg shadow-sm z-10 box-border">
                <span className="font-bold text-sm text-gray-800">M.U. %</span>
                <input
                  type="number"
                  value={markup}
                  onChange={e => setMarkup(parseFloat(e.target.value) || 0)}
                  className="w-16 p-1 bg-yellow-300 text-black font-bold outline-none text-center rounded border border-yellow-400"
                />
              </div>
          </div>

          <div className="border border-gray-800 bg-white shadow-xl rounded-sm">
            <div className="grid grid-cols-3 font-bold text-sm text-center border-b-2 border-gray-800 bg-gray-50" style={{ height: headerHeight }}>
              <div className="border-r border-gray-800 flex items-center justify-center">Manual</div>
              <div className="border-r border-gray-800 flex items-center justify-center">BASE</div>
              <div className="flex items-center justify-center">TOTAL</div>
            </div>

            <div className="flex flex-col">
              {items.map((item, index) => (
                <div key={`side-${item.id}`} className="grid grid-cols-3 border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors group" style={{ height: rowHeights[index] || 40 }}>
                  <div className="p-1 flex items-center border-r border-gray-200">
                    <input
                      type="number"
                      className={`w-full h-full text-center outline-none bg-transparent ${(item.manual_price !== undefined && item.original_price !== undefined && item.manual_price < item.original_price) ? 'text-red-600 font-bold' : ''}`}
                      value={item.manual_price !== undefined ? item.manual_price : ''}
                      onChange={e => {
                        if (e.target.value === '') updateItem(index, 'manual_price', undefined);
                        else updateItem(index, 'manual_price', parseFloat(e.target.value));
                      }}
                    />
                  </div>
                  <div className="p-1 flex items-center justify-center text-[13px] border-r border-gray-200 uppercase font-mono">
                    {item.original_price !== undefined && item.original_price !== null ? item.original_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </div>
                  <div className="p-1 flex items-center justify-center text-[13px] font-mono">
                    {item.original_price ? (item.original_price * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  </div>
                </div>
              ))}
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
              <div className="bg-white px-2 py-1 flex items-center border-r border-gray-800 text-xs">TTL PROFIT</div>
              <div className="bg-yellow-400 px-2 py-1 flex items-center justify-center font-mono text-sm">
                 {markupProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Overwrite Confirmation Modal */}
        {showOverwriteModal && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center print:hidden">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Quote ID Exists</h3>
              <p className="text-gray-600 mb-6">A quote with ID <span className="font-bold">{quoteId}</span> already exists. How would you like to proceed?</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={performSave}
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

    </div>
  );
};
