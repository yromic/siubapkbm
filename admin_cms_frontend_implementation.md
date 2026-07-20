# SIUBA CMS Landing Page Admin Frontend Implementation Guide

This document defines the architecture, routes, user interface (UI/UX) layouts, and form schemas required to implement the visual administration interface (Admin Panel) for the SIUBA Website Configuration & Modular CMS.

---

## 1. Routing & Sidebar Integration

### 1.1 Sidebar Menu Registration
Add the menu option to the system administration category in `app/(authenticated)/(modules)/layout.tsx`:

```typescript
// Add to MENU_ITEMS in layout.tsx
{
  name: "Kelola Landing Page",
  href: "/settings/cms-landing",
  roles: ["administrator", "admin"],
  category: "sistem",
  icon: <Layout className="w-5 h-5" />, // Lucide Icon
}
```

### 1.2 Route Directory Structure
Create the new pages under the settings module:
- `app/(authenticated)/(modules)/settings/cms-landing/page.tsx` (Main CMS Dashboard page)
- `components/dashboard/cms/` (Reusable CMS-specific visual forms and components)

---

## 2. Page Architecture: Tab-Based Workspace

The CMS Editor must be implemented as a unified workspace utilizing tabs to separate configuration domains:

```
+--------------------------------------------------------------------------+
|  Kelola Landing Page                                                     |
+--------------------------------------------------------------------------+
|  [ Branding ]  [ Kontak & Lokasi ]  [ Navigasi ]  [ Sections ]  [ Media ]|
+--------------------------------------------------------------------------+
|                                                                          |
|  Workspace Content Area (Dynamic forms depending on active tab)          |
|                                                                          |
+--------------------------------------------------------------------------+
```

---

## 3. Tab Configurations & UI Design

### Tab 1: Branding & Identity
Manages global visual elements and core slogans.
- **Forms**:
  - School Name (`school_name` - input text)
  - Short Name (`short_name` - input text)
  - Tagline / Slogan (`tagline` - input text)
  - Logo selector (Media library modal popup -> stores `logo_id`)
  - Favicon selector (Media library modal popup -> stores `favicon_id`)
  - Theme colors selector (`theme_branding` hex color inputs)
- **Principal Profile Card**:
  - Name, Title, and Greeting textarea
  - Photo selector (Media library modal -> stores `principal_photo_id`)

### Tab 2: Contact & Location Info
Manages electronic coordinates and physical location descriptors.
- **Forms**:
  - Telephone RAW (`contact_phone_raw` - e.g. `+6289655496283`)
  - Telephone Display (`contact_phone_display` - e.g. `0896-5549-6283`)
  - Official Email (`contact_email` - input email)
  - Address fields (Street, Village, District, Regency, Postal Code)
  - Google Maps Embed URL (`maps_embed_url` - textarea with preview box)

### Tab 3: Navigation Menus Tree Manager
Allows sorting, adding, and nesting menu links dynamically.
- **Layout**: Dropdowns for selecting target menu (`navbar` or `footer`).
- **Interaction**:
  - Vertical list of links with drag-and-drop ordering (using `framer-motion` or simple ordering buttons).
  - Add link modal (Label, URL/Anchor, target window `_self`/`_blank`).
  - Dropdown nesting support (links can be assigned a `parent_id`).

### Tab 4: Page Section Manager (Layout Assembly)
Controls visual block presence and ordering on the landing page.
- **Section List Grid**:
  - Drag-and-drop sort order control for rows.
  - Toggles for active status (`is_active` - Boolean toggle).
  - Draft indicators (`Draft` badge if the section has uncommitted changes).
- **Block Editor Panel**:
  - Clicking on a section row opens a slide-over modal containing:
    - **Header fields**: Title, Subtitle, Badge text.
    - **Repeater Item Manager**: Add/edit/delete items (e.g., adding slides, bento cards, FAQ items).
    - **Actions**:
      - `Simpan sebagai Draf`: Triggers `PATCH /api/v1/admin/sections` with `{ action: 'draft' }`.
      - `Pratinjau Draf`: Opens a new tab to `/?preview=true` to test look and feel.
      - `Publikasikan`: Copies draft content to live site, triggering Next.js static cache revalidation.

### Tab 5: Media Library (Assets Catalog)
Central catalog for all uploaded files.
- **Layout**: Grid of images fetched from `GET /api/v1/assets`.
- **Upload Dropzone**: Accepts files (WebP/PNG/SVG/JPG), registers them in database.
- **Metadata Editor Card**:
  - Clicking an asset displays details (URL, size, mime type).
  - Editable metadata fields: Alt Text (required for SEO), Title, Caption.

---

## 4. State Management & API Integration

- Use standard `react-query` or custom React hooks with `fetch` to interact with `/api/v1/admin/` routes.
- Implement validation (e.g. email checks, empty field prevention) on the client side before triggering PATCH requests.
- Add immediate success/error toast notifications using `sonner` (`lib/notify.ts`).
- Include loading skeletons and disabled submit buttons during active network calls.
