# 🚀 Dynamic Quotation - Enhancement Roadmap

This document outlines the planned UI/UX improvements and feature upgrades inspired by modern invoicing systems (Invoice-Builder, Torqvoice, Invoicerr).

## 🎨 UI/UX Modernization
- [ ] **Switch to Glassmorphism**: Update the sidebar and headers with `backdrop-blur-md` for a premium feel.
- [ ] **Floating Action Bar**: Implement a floating toolbar for "Save," "Print," and "Email" actions.
- [ ] **Enhanced Micro-animations**: Use `framer-motion` for smoother row additions and page transitions.
- [ ] **Interactive Dashboard**: Redesign the main dashboard to be more data-driven and visually cleaner.

## 📄 PDF & Export Upgrades
- [ ] **Migrate to @react-pdf/renderer**: Move away from `html2canvas` to true vector-based PDF generation.
    - [ ] Selectable and searchable text.
    - [ ] Better multi-page table handling.
    - [ ] Reduced file sizes.
- [ ] **Digital Signatures**: Add a signature pad component for clients to sign quotes digitally.

## 🤖 AI & Productivity Features
- [ ] **AI Description Enhancer**: Integrate Gemini/OpenAI to professionalize item descriptions automatically.
- [ ] **Smart Templates**: Drag-and-drop customization for "Terms & Conditions" using `@dnd-kit`.
- [ ] **Multi-language Expansion**: Improve the "Translate All" logic with more context-aware AI translations.

## 🔐 Security & Infrastructure
- [ ] **Passkey Support**: Implement biometric/Passkey login (inspired by Torqvoice).
- [ ] **Audit Trail**: Detailed logging of quote modifications (Who changed what and when).
- [ ] **Client Portal**: Secure, unique URLs for customers to view and approve quotes online.

---

## 🏆 Completed Upgrades (May 17, 2026)
- [x] **Kanban Feature Access Control**: Permission toggle integrated into the user/group permission matrix to restrict access to the pipeline.
- [x] **Interactive Product re-assignment**: Clicking any product inside Supplier DB opens a modern modal to change the supplier and update the item code on the fly.
- [x] **Supplier Product Copy & Move suite**: Checkbox multi-select matching target modals to clone or migrate products across supplier accounts in bulk.
- [x] **Products & Customers Multi-Select Bulk Delete**: Clean header Master toggle with a sticky Red action panel to safely delete records.

---
*Created: May 15, 2026*
