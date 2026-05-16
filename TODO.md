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
*Created: May 15, 2026*
