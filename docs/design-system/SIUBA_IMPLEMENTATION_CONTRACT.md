# SIUBA UI Migration — Engineering Implementation Contract

## Mandatory Engineering Rules & Normative Policy

This document constitutes the binding engineering contract governing all UI implementation and migration tasks from Sprint 1 through Sprint 7 in the SIUBA repository.

---

## 1. Scope of UI Migration
- The UI migration strictly encompasses visual presentation, layout responsiveness, accessibility, design token integration, and shared component extraction within `app/(authenticated)/(modules)` and shared `components/`.
- No backend server actions, database schema definitions, API endpoints, authentication flows, authorization checks, state management store logic, or validation contracts may be modified during UI migration tasks.

---

## 2. Coding & Architectural Conventions

### Rule 2.1 — Strict TypeScript Typings
- Every UI component MUST explicitly define its props via TypeScript `interface` or `type`.
- The use of `any`, `unknown` cast shortcuts, or un-typed inline props is strictly forbidden.

### Rule 2.2 — File Organization
- Shared atomic controls MUST reside in `components/ui/`.
- Module-specific non-shared subcomponents MUST reside within their respective module folder (`app/(authenticated)/(modules)/[module-name]/_components/`).

### Rule 2.3 — Pure Component Execution
- Components MUST remain pure rendering handlers.
- Side effects, network queries, or local storage persistence MUST be decoupled into custom hooks or passed down via props.

---

## 3. Component Reuse & Consolidation Policy

### Rule 3.1 — Reinventing Components Prohibited
- Developers and AI subagents MUST check `@/components/ui/` and `SIUBA_COMPONENT_TRACEABILITY.md` before creating new visual elements.
- Ad-hoc, inline implementations of buttons, badges, tables, or cards are strictly prohibited when a shared component exists.

### Rule 3.2 — Mandatory Extraction Threshold
- If a UI pattern (e.g., scoring button, KPI metric widget, filter chip) is repeated in 2 or more files, it MUST be extracted into a shared component under `@/components/ui/`.

---

## 4. Theme & Color Token Policy

### Rule 4.1 — CSS Custom Variables First
- Direct hex color hardcoding (e.g., `#171717`, `#0a0a0a`, `#10b981`) within TSX component JSX is strictly forbidden.
- All colors MUST reference semantic Tailwind theme tokens (`bg-surface-0`, `bg-surface-1`, `text-brand-emerald-600`) or standard CSS variables (`var(--surface-1)`).

### Rule 4.2 — Symmetric Dual-Theme Support
- Every migrated screen MUST support both Light Mode and Dark Mode identically.
- Surface levels MUST follow the 4-tier hierarchy:
  - Surface 0: Page Base (`bg-surface-0`)
  - Surface 1: Elevated Cards (`bg-surface-1`)
  - Surface 2: Hover / Secondary Inputs (`bg-surface-2`)
  - Surface 3: Borders & Dividers (`border-surface-3`)

---

## 5. Responsive Layout Policy

### Rule 5.1 — Mobile-First Breakpoint Architecture
- Layouts MUST be authored mobile-first using Tailwind default breakpoints:
  - Mobile: Base ($<768\text{px}$)
  - Tablet: `md:` ($\ge 768\text{px}$)
  - Desktop: `lg:` ($\ge 1024\text{px}$)
  - Wide Desktop: `xl:` ($\ge 1280\text{px}$)

### Rule 5.2 — Responsive Data Layout Switching
- Data tables MUST NOT force horizontal scrollbars on mobile devices.
- Dense table layouts MUST automatically switch to stacked card accordion lists on screens $<768\text{px}$ using `hidden md:block` and `block md:hidden` patterns.

---

## 6. Typography & Density Protection Policy

### Rule 6.1 — Typography Scope Enforcement
- `font-fredoka` is strictly restricted to primary module page headings (`h1`) and metric KPI stat card numbers.
- Interface text, labels, buttons, navigation items, and body copy MUST use `font-plus-jakarta`.
- All numeric table cells, monetary figures, timestamps, dates, and code IDs MUST use `font-data` (`IBM Plex Sans`).

### Rule 6.2 — Spacing & Radius Limits
- Admin cards MUST NOT use marketing section padding (`p-8`). Admin card padding MUST be `p-4` or `p-5`.
- Admin card border radius MUST NOT exceed `rounded-2xl` (16px). Input fields and buttons MUST use `rounded-xl` (12px).

---

## 7. Accessibility Policy

### Rule 7.1 — Keyboard Navigation & Focus Rings
- All interactive controls MUST include explicit, non-suppressed focus indicators: `focus-visible:ring-2 focus-visible:ring-brand-emerald-500 focus-visible:ring-offset-2`.
- Outline suppression (`focus:outline-none`) without `focus-visible` replacement is strictly forbidden.

### Rule 7.2 — Touch Targets & Screen Reader Attributes
- All touch controls on mobile viewports MUST maintain a minimum touch target of $44 \times 44\text{px}$.
- Icon-only action buttons MUST include descriptive `aria-label` attributes.

---

## 8. Business Logic & Safety Safeguards

### Rule 8.1 — Zero Logic Mutation
- No event handler logic, server action invocation, state update callback, or validation rule may be removed or altered during UI refactoring.
- If a component refactor breaks an existing unit test or type check, the UI implementation MUST be reverted and adjusted to preserve the exact functional contract.

---

## 9. Definition of Done (DoD)

A UI migration task is considered **DONE** only when all of the following criteria are verified:
1. **Design Alignment:** Visual appearance strictly matches reference design system documentation.
2. **Theme Parity:** Component renders seamlessly in both Light Mode and Dark Mode.
3. **Responsive Parity:** Component layout functions correctly across mobile ($375\text{px}$), tablet ($768\text{px}$), and desktop ($1440\text{px}$) viewports.
4. **Accessibility Check:** Interactive controls pass keyboard tab order tests and feature visible focus rings.
5. **Clean Compilation:** `npm run build` or Next.js build passes with zero TypeScript errors or lint warnings.
6. **No Regression:** All existing application features retain 100% functional integrity.

---

## 10. Approval Checklist

Before submitting any sprint migration PR for approval, verify:
- [ ] Are all hex colors replaced with semantic CSS tokens or Tailwind custom properties?
- [ ] Is `Fredoka` typography restricted strictly to primary `h1` titles and metric values?
- [ ] Do tables automatically collapse to mobile accordion lists on narrow screens?
- [ ] Have all icon buttons been given explicit `aria-label` attributes?
- [ ] Has `npm run build` executed cleanly without errors?
