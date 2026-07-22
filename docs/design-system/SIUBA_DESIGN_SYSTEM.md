# SIUBA Design System Specification

## 1. Brand Philosophy
- **Personality:** Nurturing, structured, faith-inspired, and approachable (*"penanaman adab Islami berlandaskan sunnah"*, [page.tsx:L33](file:///d:/w/siubapkbm/app/%28public%29/page.tsx#L33)).
- **Emotional Tone:** Calming, reassuring, and child-centered using soft pastels (`bg-brand-emerald-50`, `bg-brand-lime-50`) and rounded component boundaries.
- **Professional Credibility:** Modern institutional credibility with glassmorphism navigation ([Navbar.tsx:L38](file:///d:/w/siubapkbm/components/landing/Navbar.tsx#L38)) and structured JSON-LD educational metadata ([page.tsx:L41](file:///d:/w/siubapkbm/app/%28public%29/page.tsx#L41)).
- **Accessibility Cues:** High contrast body text (`text-zinc-800` / `text-zinc-900`) on `#fdfbf7` warm cream backgrounds.

## 2. Visual Language
- **Design Style:** Organic Soft Modernism combined with Glassmorphism.
- **Geometric Language:** Heavy preference for rounded surfaces (`rounded-[24px]` cards, `rounded-xl`/`rounded-2xl` buttons, `rounded-full` badges) and organic SVG wave section masks.
- **Whitespace Philosophy:** Expansive vertical layout rhythm (`py-24` section padding, `mb-16` to `mb-20` header margins).
- **Information Density:** Low-to-Medium on marketing pages; max 3-column card layouts (`grid-cols-1 md:grid-cols-3`).

## 3. Color System (Verified Tokens)
Extracted directly from [globals.css](file:///d:/w/siubapkbm/app/globals.css):

### Brand Palette
- `brand-emerald-50`: `#f0fdf4`
- `brand-emerald-100`: `#dcfce7`
- `brand-emerald-500`: `#10b981` (Primary Brand Color)
- `brand-emerald-600`: `#059669` (Primary Interactive State)
- `brand-emerald-700`: `#047857` (Primary Active/Focus State)
- `brand-lime-50`: `#f7fee7`
- `brand-lime-100`: `#ecfccb`
- `brand-lime-500`: `#84cc16` (Secondary Accent)
- `brand-lime-600`: `#65a30d`
- `brand-amber-50`: `#fffbeb`
- `brand-amber-100`: `#fef3c7`
- `brand-amber-500`: `#f59e0b` (Warning Accent)
- `brand-amber-600`: `#d97706`
- `brand-cream`: `#fdfbf7` (Primary Light Background)

### Light Surfaces
- `--background`: `#fdfbf7`
- `--surface-0`: `#fdfbf7`
- `--surface-1`: `#ffffff`
- `--surface-2`: `#f4f4f5`
- `--surface-3`: `#e4e4e7`

### Dark Surfaces
- `--background`: `#0a0a0a`
- `--surface-0`: `#0a0a0a`
- `--surface-1`: `#171717`
- `--surface-2`: `#262626`
- `--surface-3`: `#2d2d2d`

## 4. Typography
Font definitions from [layout.tsx](file:///d:/w/siubapkbm/app/layout.tsx):
- **Display Font (`--font-fredoka`):** Used exclusively for headings (`h1`, `h2`, `h3`) and card titles ([Hero.tsx:L135](file:///d:/w/siubapkbm/components/landing/Hero.tsx#L135)).
- **Body & Interface Font (`--font-plus-jakarta`):** Used for navigation, body paragraphs, buttons, and captions.
- **Data & Tabular Font (`--font-ibm-plex-sans`):** Registered for numeric and tabular admin data.
- **Heading Scale:** H1 (`text-4xl` to `text-7xl`), H2 (`text-3xl` to `text-5xl`), H3 (`text-lg` to `text-xl`).

## 5. Spacing & Radius Scale

### Radius Tokens
- **Cards:** `rounded-[24px]` (24px)
- **Accordions / Sub-containers:** `rounded-[20px]` (20px)
- **Buttons / Header Shell:** `rounded-xl` (12px) or `rounded-2xl` (16px)
- **Badges / Chips:** `rounded-full` (9999px)

### Spacing Scale
- Section Padding: `py-24` (96px)
- Card Inner Padding: `p-8` (32px)
- Grid Container Width: `max-w-7xl` (1280px max width) with `px-6` to `px-8`

## 6. Shadow & Elevation System
- `shadow-sm`: Standard card resting state ([Programs.tsx:L74](file:///d:/w/siubapkbm/components/landing/Programs.tsx#L74)).
- `shadow-md shadow-brand-emerald-500/10`: Interactive button state ([Navbar.tsx:L81](file:///d:/w/siubapkbm/components/landing/Navbar.tsx#L81)).
- `shadow-lg shadow-brand-emerald-500/25`: Primary hero CTA and scrolled header ([Hero.tsx:L149](file:///d:/w/siubapkbm/components/landing/Hero.tsx#L149)).
- `shadow-xl`: Mobile drawer popover ([Navbar.tsx:L107](file:///d:/w/siubapkbm/components/landing/Navbar.tsx#L107)).

## 7. Motion System
- Framework: Framer Motion + standard CSS utility transitions (`transition-all duration-300`).
- Scroll Reveal: `initial={{ opacity: 0, y: 30 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true }}`.
- Hover Effects: Y-axis lift `whileHover={{ y: -6 }}` or `hover:-translate-y-0.5`.

## 8. Component Language Summary
- **Navbar:** Floating pill header `rounded-2xl`, glass opacity `bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md`.
- **Cards:** `rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 p-8`.
- **Accordions:** Wrapped in `rounded-[20px] border border-zinc-200/60`, circular toggle button `w-8 h-8 rounded-full`.

## 9. UX Principles
- **Low Cognitive Pressure:** Generous vertical whitespace (`py-24`) reduces visual clutter.
- **Friendly Typographic Contrast:** Expressive display title (`Fredoka`) paired with clean body typeface (`Plus Jakarta Sans`).
- **Clear Reassurance Signals:** Prominent placement of accreditation tags, graduate profiles, and contact maps.

## 10. Dashboard Adaptation & Regression Notes
- **Card Compression:** Landing page card padding (`p-8`) and radius (`24px`) must compress to `p-5` and `16px` for admin screens.
- **Typography Scannability:** Restrict `Fredoka` strictly to primary page titles (`h1`) and metric KPI values. Tables, forms, and dense data views must use `Plus Jakarta Sans` or `IBM Plex Sans`.
- **Decorative Elements:** Suppress continuous Framer Motion background loops and organic SVG wave masks in admin dashboard views.
