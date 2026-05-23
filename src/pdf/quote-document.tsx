import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";

Font.register({
  family: "Tajawal",
  fonts: [
    { src: "https://raw.githubusercontent.com/googlefonts/tajawal/main/fonts/ttf/Tajawal-Regular.ttf", fontWeight: "normal" },
    { src: "https://raw.githubusercontent.com/googlefonts/tajawal/main/fonts/ttf/Tajawal-Bold.ttf", fontWeight: "bold" },
  ],
});

export type PdfLine = {
  description: string;
  descriptionAr?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount?: number;
};

export type PdfCustomer = {
  company: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

export type PdfSettings = {
  companyName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  footerImageUrl?: string | null;
  brandColor: string;
  taxLabel: string;
  pdfPayment?: string | null;
  pdfWarranty?: string | null;
  pdfManpower?: string | null;
  pdfMobilization?: string | null;
  pdfDuration?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankIban?: string | null;
  bankAccountName?: string | null;
  footerText?: string | null;
};

export type PdfQuote = {
  number: string;
  createdAt: Date | string;
  validUntil: Date | string | null;
  currency: string;
  subject?: string | null;
  subjectAr?: string | null;
  notes?: string | null;
  notesAr?: string | null;
  payment?: string | null;
  paymentAr?: string | null;
  warranty?: string | null;
  warrantyAr?: string | null;
  manpower?: string | null;
  manpowerAr?: string | null;
  mobilization?: string | null;
  mobilizationAr?: string | null;
  duration?: string | null;
  durationAr?: string | null;
  bankDetails?: string | null;
  bankDetailsAr?: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  customer: PdfCustomer;
  lines: PdfLine[];
};

export function lineNetPrice(line: PdfLine): number {
  return line.quantity * line.unitPrice * (1 - (line.discount || 0) / 100);
}

// ── BILINGUAL TRANSLATION HELPERS ──────────────────────────────────────────────
// NOTE: Do NOT use U+200E (LTR mark) — @react-pdf/renderer renders it as a
// visible glyph (&) in the Tajawal font. Arabic bidi is handled natively.

export const standardTranslations: Record<string, string> = {
  "Full Payment in ADVANCE": "الدفع الكامل مقدماً",
  "80% Downpayment | Balance before completion.": "80% دفعة مقدمة | الرصيد قبل الإكمال",
  "2 YEARS limited warranty and/or supplier's recommendation": "ضمان محدود لمدة عامين و/أو توصية المورد",
  "2 YEARS limited warranty and/or supplier's recommendation.": "ضمان محدود لمدة عامين و/أو توصية المورد.",
  "1 YEAR limited warranty and/or supplier's recommendation": "ضمان محدود لمدة سنة و/أو توصية المورد",
  "2 Technicians, 1 Supervisor": "2 فنيين، 1 مشرف",
  "2 Technicians, 1 Supervisor.": "2 فنيين، 1 مشرف.",
  "3 Technicians, 1 Supervisor": "3 فنيين، 1 مشرف",
  "3 Technicians, 1 Supervisor.": "3 فنيين، 1 مشرف.",
  "4 Technicians, 1 Supervisor": "4 فنيين، 1 مشرف",
  "4 Technicians, 1 Supervisor.": "4 فنيين، 1 مشرف.",
  "1-2 days upon confirmation of payment": "1-2 أيام بعد تأكيد الدفع",
  "2-3 days upon confirmation of payment": "2-3 أيام بعد تأكيد الدفع",
  "2-3 days upon confirmation of payment.": "2-3 أيام بعد تأكيد الدفع.",
  "3-4 days upon confirmation of payment": "3-4 أيام بعد تأكيد الدفع",
  "3-4 days upon confirmation of payment.": "3-4 أيام بعد تأكيد الدفع.",
  "4-5 days upon confirmation of payment": "4-5 أيام بعد تأكيد الدفع",
  "1-2 Working Days": "1-2 يوم عمل",
  "1-2 Working Days.": "1-2 يوم عمل.",
  "2-3 Working Days": "2-3 يوم عمل",
  "3-4 Working Days": "3-4 يوم عمل",
  "4-5 Working Days": "4-5 يوم عمل",
  "4-5 Working Days.": "4-5 يوم عمل.",
  "5-7 Working Days": "5-7 يوم عمل",
  "10-14 Working Days": "10-14 يوم عمل",
  "25-30 Working Days": "25-30 يوم عمل",
  "25-30 Working Days.": "25-30 يوم عمل.",
  "Any additional work/device will be considered Change Order": "سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير",
  "Any additional work/device will be considered Change Order.": "سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير.",
  "Any additional work|device will be considered Change Order": "سيتم اعتبار أي عمل إضافي|جهاز بمثابة أمر تغيير",
  "Internet source is provided by the OWNER.": "يتم توفير مصدر الإنترنت من قبل المالك.",
  "Internet source is provided by the OWNER": "يتم توفير مصدر الإنترنت من قبل المالك",
};

export function getBilingualParts(en: string | null | undefined, ar: string | null | undefined) {
  if (!en && !ar) return { en: "", ar: "" };
  // Both sides supplied — use as-is
  if (en && ar) return { en: en.trim(), ar: ar.trim() };
  const value = (en || ar || "").trim();
  // "|" as bilingual separator (only when ar is absent)
  if (!ar && value.includes("|")) {
    const parts = value.split("|");
    return { en: parts[0].trim(), ar: parts[1]?.trim() ?? "" };
  }
  // Lookup translation table
  if (!ar && standardTranslations[value]) {
    return { en: value, ar: standardTranslations[value] };
  }
  return { en: en || value, ar: ar || "" };
}

export function getBilingualNotes(notes: string | null | undefined, notesAr?: string | null) {
  // Prefer separately stored Arabic notes
  if (notesAr?.trim()) {
    const enLines = (notes ?? "").split("\n").filter(Boolean);
    const arLines = notesAr.split("\n").filter(Boolean);
    const count = Math.max(enLines.length, arLines.length, 1);
    return Array.from({ length: count }, (_, i) => ({
      en: enLines[i] ?? enLines[0] ?? "",
      ar: arLines[i] ?? arLines[0] ?? "",
    }));
  }
  if (!notes) return [];
  return notes.split("\n").map((line) => {
    const cleanLine = line.trim();
    // Check if the line itself is a "|" bilingual pair (not the word "work|device")
    const pipeIdx = cleanLine.indexOf("|");
    if (pipeIdx !== -1 && pipeIdx > 10) {
      // Only treat as bilingual separator when pipe is not within the first 10 chars
      const parts = cleanLine.split("|");
      return { en: parts[0].trim(), ar: parts[1]?.trim() ?? "" };
    }
    if (standardTranslations[cleanLine]) return { en: cleanLine, ar: standardTranslations[cleanLine] };
    // Fallback: build Arabic from known sub-strings
    let ar = "";
    if (cleanLine.includes("Any additional work") && cleanLine.includes("Change Order"))
      ar += "سيتم اعتبار أي عمل إضافي/جهاز بمثابة أمر تغيير";
    if (cleanLine.includes("Internet source is provided by the OWNER"))
      ar += (ar ? "\n" : "") + "يتم توفير مصدر الإنترنت من قبل المالك";
    return { en: cleanLine, ar };
  });
}

export type PdfTermRow = { label: string; en: string; ar: string };

export function buildPdfTermRows(
  quote: {
    payment?: string | null; paymentAr?: string | null;
    warranty?: string | null; warrantyAr?: string | null;
    manpower?: string | null; manpowerAr?: string | null;
    mobilization?: string | null; mobilizationAr?: string | null;
    duration?: string | null; durationAr?: string | null;
  },
  settings: {
    pdfPayment?: string | null; pdfWarranty?: string | null;
    pdfManpower?: string | null; pdfMobilization?: string | null;
    pdfDuration?: string | null;
  }
): PdfTermRow[] {
  const rows = [
    { label: "PAYMENT", en: quote.payment ?? settings.pdfPayment, ar: quote.paymentAr },
    { label: "WARRANTY", en: quote.warranty ?? settings.pdfWarranty, ar: quote.warrantyAr },
    { label: "MANPOWER", en: quote.manpower ?? settings.pdfManpower, ar: quote.manpowerAr },
    { label: "MOBILIZATION", en: quote.mobilization ?? settings.pdfMobilization, ar: quote.mobilizationAr },
    { label: "DURATION", en: quote.duration ?? settings.pdfDuration, ar: quote.durationAr },
  ];
  return rows
    .filter((r) => r.en || r.ar)
    .map((r) => {
      const parts = getBilingualParts(r.en, r.ar);
      return { label: r.label, en: parts.en, ar: parts.ar };
    });
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const COL = {
  item: 28,
  qty: 34,
  unit: 34,
  unitPrice: 72,
  netPrice: 76,
};

const styles = StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 20, paddingBottom: 60, fontSize: 8, fontFamily: "Tajawal", color: "#18181b" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  metaRow: { flexDirection: "row", gap: 4, alignItems: "center", marginBottom: 2 },
  metaLabel: { fontSize: 8, color: "#52525b" },
  metaValue: { fontSize: 8, fontWeight: "bold" },
  customerBox: { borderWidth: 0.5, borderColor: "#18181b", marginBottom: 10 },
  customerHeader: { backgroundColor: "#f4f4f5", paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: "#18181b" },
  customerHeaderText: { fontSize: 8.5, fontWeight: "bold" },
  customerContent: { padding: 6, gap: 3 },
  customerRow: { flexDirection: "row", justifyContent: "space-between" },
  customerCol: { flexDirection: "row", gap: 3 },
  lbl: { fontWeight: "bold" },
  table: { marginBottom: 8 },
  tableHeaderRow: { flexDirection: "row" },
  th: { color: "#ffffff", fontSize: 7.5, fontWeight: "bold", padding: 5, textAlign: "center" },
  thDesc: { color: "#ffffff", fontSize: 7.5, fontWeight: "bold", padding: 5 },
  tableRow: { flexDirection: "row" },
  cell: { padding: 5, fontSize: 7.5 },
  border: { borderLeftWidth: 0.5, borderLeftColor: "#18181b", borderBottomWidth: 0.5, borderBottomColor: "#18181b" },
  borderTop: { borderTopWidth: 0.5, borderTopColor: "#18181b" },
  borderRight: { borderRightWidth: 0.5, borderRightColor: "#18181b" },
  noteBox: { flex: 1, borderWidth: 0.5, borderColor: "#18181b", padding: 6 },
  totalsBox: { width: 158, borderWidth: 0.5, borderColor: "#18181b" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 3, borderBottomWidth: 0.5, borderColor: "#18181b" },
  totalPkg: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 5, fontWeight: "bold", color: "#ffffff" },
  termsSection: { marginTop: 5, gap: 3 },
  termRow: { flexDirection: "row", justifyContent: "space-between" },
  termLeft: { flexDirection: "row", gap: 3, flex: 1 },
  bankSection: { marginTop: 5, borderTopWidth: 0.5, borderTopColor: "#d4d4d8", paddingTop: 4 },
});

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export function QuotePdfDocument({ quote, settings }: { quote: PdfQuote; settings: PdfSettings }) {
  const brand = settings.brandColor || "#039737";

  const customerAddress = [
    quote.customer.address,
    [quote.customer.city, quote.customer.country].filter(Boolean).join(", "),
  ].filter(Boolean).join(", ");

  const termsRows = buildPdfTermRows(quote, settings);
  const noteItems = getBilingualNotes(quote.notes, quote.notesAr);
  const bank = getBilingualParts(quote.bankDetails, quote.bankDetailsAr);

  const cellBorder = [styles.border];
  const cellBorderRight = [styles.border, styles.borderRight];

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <View wrap={false} style={styles.headerRow}>
          <View>
            <Text style={styles.title}>QUOTATION</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Quote ID / رقم العرض:</Text>
              <Text style={styles.metaValue}>{quote.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date / التاريخ:</Text>
              <Text style={styles.metaValue}>{fmtDate(quote.createdAt)}</Text>
            </View>
            {quote.validUntil && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Valid Until / صالح لغاية:</Text>
                <Text style={styles.metaValue}>{fmtDate(quote.validUntil)}</Text>
              </View>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {settings.logoUrl ? (
              <Image src={settings.logoUrl} style={{ width: 130, height: 50, objectFit: "contain" }} />
            ) : (
              <Text style={{ fontSize: 12, fontWeight: "bold", color: brand, textAlign: "right", maxWidth: 150 }}>
                {settings.companyName}
              </Text>
            )}
          </View>
        </View>

        {/* ── CUSTOMER INFO ───────────────────────────────────────────── */}
        <View wrap={false} style={styles.customerBox}>
          <View style={styles.customerHeader}>
            <Text style={styles.customerHeaderText}>CUSTOMER INFO</Text>
          </View>
          <View style={styles.customerContent}>
            <View style={styles.customerRow}>
              <View style={styles.customerCol}>
                <Text style={styles.lbl}>Customer:</Text>
                <Text style={{ fontWeight: "bold" }}>{quote.customer.company}</Text>
              </View>
              <View style={styles.customerCol}>
                <Text style={styles.lbl}>Mobile:</Text>
                <Text>{quote.customer.phone || ""}</Text>
              </View>
            </View>
            <View style={styles.customerRow}>
              <View style={styles.customerCol}>
                <Text style={styles.lbl}>Address:</Text>
                <Text>{customerAddress}</Text>
              </View>
            </View>
            <View style={styles.customerRow}>
              <View style={styles.customerCol}>
                <Text style={styles.lbl}>Contact:</Text>
                <Text>{quote.customer.contactName || ""}</Text>
              </View>
              <View style={styles.customerCol}>
                <Text style={styles.lbl}>E-mail:</Text>
                <Text>{quote.customer.email || ""}</Text>
              </View>
            </View>
            {(quote.subject || quote.subjectAr) && (
              <View style={{ borderTopWidth: 0.5, borderTopColor: "#d4d4d8", paddingTop: 4, marginTop: 2, flexDirection: "row", justifyContent: "space-between" }}>
                <View style={[styles.customerCol, { flex: 1 }]}>
                  <Text style={styles.lbl}>Subject:</Text>
                  <Text style={{ flex: 1 }}>{quote.subject}</Text>
                </View>
                {quote.subjectAr && <Text style={{ flex: 1, textAlign: "right" }}>{quote.subjectAr}</Text>}
              </View>
            )}
          </View>
        </View>

        {/* ── ITEMS TABLE ─────────────────────────────────────────────── */}
        <View style={styles.table}>
          {/* Header */}
          <View wrap={false} style={[styles.tableHeaderRow, { backgroundColor: brand }]}>
            <View style={[{ width: COL.item }, styles.border, styles.borderTop]}>
              <Text style={styles.th}>ITEM</Text>
            </View>
            <View style={[{ flex: 1 }, styles.border, styles.borderTop]}>
              <Text style={styles.thDesc}>DESCRIPTION</Text>
            </View>
            <View style={[{ width: COL.qty }, styles.border, styles.borderTop]}>
              <Text style={styles.th}>QTY</Text>
            </View>
            <View style={[{ width: COL.unit }, styles.border, styles.borderTop]}>
              <Text style={styles.th}>UNIT</Text>
            </View>
            <View style={[{ width: COL.unitPrice }, styles.border, styles.borderTop]}>
              <Text style={[styles.th, { textAlign: "right" }]}>UNIT PRICE</Text>
            </View>
            <View style={[{ width: COL.netPrice }, cellBorderRight, styles.borderTop]}>
              <Text style={[styles.th, { textAlign: "right" }]}>NET PRICE</Text>
            </View>
          </View>

          {/* Rows */}
          {quote.lines.map((line, i) => (
            <View key={i} wrap={false} style={[styles.tableRow, { backgroundColor: i % 2 === 1 ? "#f4f4f5" : "#ffffff" }]}>
              <View style={[{ width: COL.item }, ...cellBorder]}>
                <Text style={[styles.cell, { textAlign: "center" }]}>{i + 1}</Text>
              </View>
              <View style={[{ flex: 1 }, ...cellBorder]}>
                <View style={{ flexDirection: "row" }}>
                  <Text style={[styles.cell, { flex: 1 }]}>{line.description}</Text>
                  {line.descriptionAr ? (
                    <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{line.descriptionAr}</Text>
                  ) : null}
                </View>
              </View>
              <View style={[{ width: COL.qty }, ...cellBorder]}>
                <Text style={[styles.cell, { textAlign: "center" }]}>{line.quantity}</Text>
              </View>
              <View style={[{ width: COL.unit }, ...cellBorder]}>
                <Text style={[styles.cell, { textAlign: "center" }]}>{line.unit}</Text>
              </View>
              <View style={[{ width: COL.unitPrice }, ...cellBorder]}>
                <Text style={[styles.cell, { textAlign: "right" }]}>{fmt(line.unitPrice)}</Text>
              </View>
              <View style={[{ width: COL.netPrice }, ...cellBorderRight]}>
                <Text style={[styles.cell, { textAlign: "right", fontWeight: "bold" }]}>{fmt(lineNetPrice(line))}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── NOTE + TOTALS ───────────────────────────────────────────── */}
        <View style={{ marginTop: 6 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {/* Note box */}
            <View style={styles.noteBox}>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <Text style={{ fontWeight: "bold", minWidth: 38 }}>NOTE:</Text>
                <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
                  {/* English lines */}
                  <View style={{ flex: 1 }}>
                    {noteItems.map((item, idx) => (
                      <Text key={idx} style={{ fontSize: 7.5, marginBottom: 1 }}>{item.en}</Text>
                    ))}
                  </View>
                  {/* Arabic lines */}
                  {noteItems.some((n) => n.ar) && (
                    <View style={{ flex: 1 }}>
                      {noteItems.map((item, idx) => (
                        <Text key={idx} style={{ fontSize: 7.5, textAlign: "right", marginBottom: 1 }}>{item.ar}</Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Totals box */}
            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={{ fontWeight: "bold" }}>SUBTOTAL</Text>
                <Text>{quote.currency} {fmt(quote.subtotal)}</Text>
              </View>
              {quote.discountTotal > 0 && (
                <View style={styles.totalRow}>
                  <Text style={{ fontWeight: "bold" }}>DISCOUNT</Text>
                  <Text>-{quote.currency} {fmt(quote.discountTotal)}</Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={{ fontWeight: "bold" }}>{settings.taxLabel}</Text>
                <Text>{quote.currency} {fmt(quote.taxTotal)}</Text>
              </View>
              <View style={[styles.totalPkg, { backgroundColor: brand }]}>
                <Text>TOTAL PACKAGE</Text>
                <Text>{quote.currency} {fmt(quote.total)}</Text>
              </View>
            </View>
          </View>

          {/* ── TERMS ───────────────────────────────────────────────── */}
          {termsRows.length > 0 && (
            <View style={styles.termsSection}>
              {termsRows.map((row) => (
                <View key={row.label} style={styles.termRow}>
                  <View style={styles.termLeft}>
                    <Text style={{ fontWeight: "bold" }}>{row.label}:</Text>
                    <Text style={{ flex: 1 }}>{row.en}</Text>
                  </View>
                  {row.ar ? (
                    <Text style={{ flex: 1, textAlign: "right" }}>{row.ar}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* ── BANK DETAILS ─────────────────────────────────────────── */}
          {(bank.en || bank.ar) && (
            <View style={styles.bankSection}>
              <Text style={{ fontWeight: "bold", marginBottom: 2 }}>BANK DETAILS</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ flex: 1 }}>{bank.en}</Text>
                {bank.ar ? <Text style={{ flex: 1, textAlign: "right" }}>{bank.ar}</Text> : null}
              </View>
            </View>
          )}
        </View>

        {/* ── FOOTER IMAGE ─────────────────────────────────────────── */}
        {settings.footerImageUrl && (
          <View fixed style={{ position: "absolute", bottom: 10, left: 0, right: 0, alignItems: "center" }}>
            <Image src={settings.footerImageUrl} style={{ width: "100%", height: 50, objectFit: "contain" }} />
          </View>
        )}

      </Page>
    </Document>
  );
}
