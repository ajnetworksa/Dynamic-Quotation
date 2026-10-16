// Tiny i18n layer (English / Arabic). Strings not in the dictionary fall back to the English key, so screens can be
// translated one at a time: wrap a label in t('Label') and add its Arabic here.
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'ar';

const AR: Record<string, string> = {
  // navigation
  'Dashboard': 'لوحة التحكم', 'Docs': 'المستندات', 'Product DB': 'المنتجات', 'Customer DB': 'العملاء',
  'Supplier DB': 'الموردون', 'Tracking': 'المتابعة', 'Kanban': 'كانبان', 'Recycle Bin': 'سلة المحذوفات',
  'Users': 'المستخدمون', 'Settings': 'الإعدادات', 'Skip to content': 'تخطي إلى المحتوى',
  // statuses
  'Draft': 'مسودة', 'Sent': 'مرسل', 'Accepted': 'مقبول', 'Rejected': 'مرفوض', 'Invoiced': 'تمت الفوترة', 'Cancelled': 'ملغي',
  // kanban / dashboard
  'Quotation Kanban': 'لوحة عروض الأسعار', 'Track and manage your quotation pipeline': 'تابع وأدر مسار عروض الأسعار',
  '+ New Quote': '+ عرض سعر جديد', 'No quotes': 'لا توجد عروض', 'Total Documents': 'إجمالي المستندات',
  'Won Revenue': 'الإيرادات المحققة', 'This Month (Won)': 'هذا الشهر (محقق)', 'Win Rate': 'نسبة النجاح',
  'Conversion Metrics': 'مؤشرات التحويل', 'New Document': 'مستند جديد', 'View All': 'عرض الكل',
  // common
  'Save': 'حفظ', 'Cancel': 'إلغاء', 'Close': 'إغلاق', 'Delete': 'حذف', 'Edit': 'تعديل', 'Search': 'بحث',
  'Loading…': 'جارٍ التحميل…', 'Language': 'اللغة', 'Light Mode': 'الوضع الفاتح', 'Dark Mode': 'الوضع الداكن',
  'Sign In': 'تسجيل الدخول', 'Username': 'اسم المستخدم', 'Password': 'كلمة المرور', 'Remember me': 'تذكرني',
  'Sign out': 'تسجيل الخروج', 'Reload': 'إعادة التحميل',
  'This Month (Docs)': 'هذا الشهر (مستندات)', 'Pending / Draft': 'قيد الانتظار / مسودة', 'Lost Deals': 'صفقات خاسرة', 'Currency': 'العملة',
};

const DICT: Record<Lang, Record<string, string>> = { en: {}, ar: AR };

let lang: Lang = (() => {
  try { return localStorage.getItem('lang') === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
})();
const listeners = new Set<() => void>();

function applyToDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}
applyToDocument();

export const getLang = () => lang;
export function setLang(next: Lang) {
  lang = next;
  try { localStorage.setItem('lang', next); } catch { /* storage unavailable */ }
  applyToDocument();
  listeners.forEach(l => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Translate a UI string (falls back to the English text). Safe to call outside React; use useLang() to re-render. */
export const t = (text: string): string => DICT[lang][text] ?? text;

/** Subscribes the component to language changes and returns the current language. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang);
}
