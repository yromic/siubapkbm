# Website Configuration & Modular CMS Implementation Roadmap

This document outlines the phased breakdown for implementing the Website Configuration System and Modular CMS on the SIUBA platform, as defined in [content_architecture_design.md](file:///d:/w/siubapkbm/content_architecture_design.md).

---

## Phase 1: Core Identity, Global Config, Assets & SEO Engine

**Goal**: Build the foundation for website configuration, media assets, dynamic SEO metadata, and crawling assets.

### 1. Database Schema
Create a Knex migration for:
- `assets` table: Central media library storing URL, mime type, size, alt text, title, and caption.
- `website_config` table: Singleton or key-value settings mapping school identity, contact info, branding, SEO defaults, and principal identity (referencing `assets` for logo, favicon, and principal photo).

### 2. Service & APIs
- **Asset Service**: Uploading/registering assets, resolving URLs, updating SEO meta (alt, title, caption).
- **Config Service**: Retrieval of active config, updating config fields.
- **Config APIs**:
  - `GET /api/v1/config` (Public)
  - `PATCH /api/v1/admin/config` (Protected)

### 3. Front-End / SEO Integration
- **Dynamic SEO Metadata**: Update `app/layout.tsx` or root page to fetch settings via `generateMetadata()`.
- **Dynamic Crawler Directives**:
  - Implement dynamic `sitemap.ts` reading canonical base url from database.
  - Implement dynamic `robots.ts` reading disallow/allow rules.
  - Implement dynamic `manifest.ts` reading branding theme and identity.
- **JSON-LD Structured Data**: Inject dynamic `EducationalOrganization` schema in `app/(public)/page.tsx` using active config.

---

## Phase 2: Dynamic Navigation Menu System

**Goal**: Replace hardcoded links in Navbar and Footer with dynamic, hierarchy-aware menus managed in the database.

### 1. Database Schema
Create a Knex migration for:
- `navigation_menus` table (e.g., 'navbar', 'footer').
- `navigation_links` table (parent-child relationship for dropdowns, ordering, target window).

### 2. Service & APIs
- **Navigation Service**: Fetch hierarchical menu trees, manage links.
- **Navigation APIs**:
  - `GET /api/v1/navigation` (Public menu lookup)
  - `POST/PATCH/DELETE /api/v1/admin/navigation` (Protected admin controls)

### 3. Component Integration
- Refactor `components/landing/Navbar.tsx` and `components/landing/Footer.tsx` to fetch menu items dynamically.
- Keep static menus as hardcoded fallbacks to ensure zero breakage if database query fails.

---

## Phase 3: Modular Sections & Repeater Items Schema (CMS Foundation)

**Goal**: Create tables to support dynamic sections and repeatable items, allowing section customization without schema changes.

### 1. Database Schema
Create a Knex migration for:
- `sections` table: Core visual block container (`type`, `title`, `subtitle`, `badge`, `sort_order`, `is_active`, `content` JSONB).
- `section_items` table: Nested items referencing `sections` and `assets` (`title`, `subtitle`, `description`, `badge`, `icon`, `image_id`, `sort_order`, `link_url`, `link_text`, `custom_fields` JSONB).

### 2. Service & APIs
- **Section Service**: Create/update section configurations, add/remove/reorder section items.
- **Section APIs**:
  - `GET /api/v1/sections` (Public landing section fetch)
  - `POST/PATCH/DELETE /api/v1/admin/sections` (Protected dashboard section management)

---

## Phase 4: Dynamic Landing Page Renderer

**Goal**: Implement the client-side component registry and fully dynamic landing page rendering.

### 1. UI Registry Mapping
- Create a registry map `components/landing/registry.ts` associating section type strings (e.g., `'hero'`, `'why-choose-us'`, `'about'`) with their corresponding visual components.
- Refactor landing page sections to accept structured data props instead of using hardcoded mock files or state.

### 2. Dynamic Landing Page Assembly
- Modify `app/(public)/page.tsx` to fetch active sections and items in a single query.
- Map and loop through rows to build the landing page dynamically via the registry.

---

## Phase 5: Section Versioning & Draft Workflows

**Goal**: Add publication controls, preview states, and Next.js ISR (Incremental Static Regeneration) cache revalidation.

### 1. Database & Schema Enhancements
Add columns to `sections` and `section_items`:
- `is_draft`, `draft_content` (JSONB for staged settings), `published_at`, `updated_by`, `published_by`.

### 2. Service, APIs & Preview Workflow
- **Preview Endpoint**: `GET /api/preview` to set preview cookies or headers, enabling rendering of drafts.
- **Publish Endpoint**: `POST /api/v1/admin/sections/:id/publish` to copy `draft_content` into live `content` and mark `is_draft = false`.
- **Revalidation Hook**: Trigger cache revalidation via `revalidatePath("/")` on publication to instantly refresh the static landing page.
