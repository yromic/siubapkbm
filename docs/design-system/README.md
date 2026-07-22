# SIUBA Design System Documentation Index

## Purpose of the Documentation
This directory (`docs/design-system/`) serves as the official, evidence-based Design System & Theme Architecture reference for the SIUBA ecosystem (Landing Page and Enterprise Admin Panel). It provides technical guidance for human software engineers and AI coding agents to ensure visual consistency, accessibility compliance, and zero-regression UI implementation.

## Source of Truth
All design tokens, visual rules, and architectural patterns in this directory were extracted strictly from verified repository evidence:
- Primary Style Configuration: [app/globals.css](file:///d:/w/siubapkbm/app/globals.css)
- Root Viewport & Metadata: [app/layout.tsx](file:///d:/w/siubapkbm/app/layout.tsx)
- Landing Page Implementation: [app/(public)/page.tsx](file:///d:/w/siubapkbm/app/%28public%29/page.tsx)
- Component Registry & Core UI Components: [components/landing/](file:///d:/w/siubapkbm/components/landing)

## Document Hierarchy & Navigation

1. **[SIUBA_DESIGN_SYSTEM.md](file:///d:/w/siubapkbm/docs/design-system/SIUBA_DESIGN_SYSTEM.md)**  
   *Core Visual Language & Design Tokens*  
   Contains the verified design token inventory (colors, typography, spacing, border radii, shadows, motion) and component language extracted directly from the landing page.

2. **[SIUBA_THEME_SYSTEM.md](file:///d:/w/siubapkbm/docs/design-system/SIUBA_THEME_SYSTEM.md)**  
   *Theme System Architecture & Light/Dark Audit*  
   Documents the CSS custom variable implementation, surface token levels, glassmorphism parameters, and light/dark theme adaptation matrix.

3. **[SIUBA_ADMIN_UI_GUIDELINES.md](file:///d:/w/siubapkbm/docs/design-system/SIUBA_ADMIN_UI_GUIDELINES.md)**  
   *Enterprise Admin Panel Implementation Guidelines*  
   Normative engineering standards, DO/DON'T rules, dashboard component adaptation rules, and regression prevention checklists for developers and AI agents building admin features.

## Recommended Reading Order
1. **Developers / AI Agents building new UI features:** Read [SIUBA_ADMIN_UI_GUIDELINES.md](file:///d:/w/siubapkbm/docs/design-system/SIUBA_ADMIN_UI_GUIDELINES.md) first, referencing [SIUBA_DESIGN_SYSTEM.md](file:///d:/w/siubapkbm/docs/design-system/SIUBA_DESIGN_SYSTEM.md) for exact design tokens.
2. **Architects / Designers modifying themes:** Read [SIUBA_THEME_SYSTEM.md](file:///d:/w/siubapkbm/docs/design-system/SIUBA_THEME_SYSTEM.md).

## Update & Maintenance Policy
- **Zero Hallucination Policy:** No design token or rule may be added to this documentation without direct implementation evidence in the repository codebase.
- **Verification Rule:** If an element cannot be verified from available code, it must be explicitly marked as: `Unable to verify from the available evidence.`
- **Modifications:** Updates to tokens in `globals.css` or Tailwind config must be reflected synchronously across these documentation files.
