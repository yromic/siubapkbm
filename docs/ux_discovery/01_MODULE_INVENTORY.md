# Observable Module Inventory

This inventory documents all observable modules discovered in the SIUBA PKBM source code.

---

## 1. Authentication & Session Module
- **Module Name**: Authentication & Security
- **Purpose**: Staff & Parent login, MFA TOTP verification, session revocation, ALTCHA bot challenge.
- **Primary Personas**: All Roles (`administrator`, `admin`, `teacher`, `parent`)
- **Entry Routes**: `/login`, `/parent/login`
- **Parent Module**: Root
- **Child Pages**: None (Modal/Inline state transitions for MFA)
- **Dialogs / Drawers**: MFA Challenge Modal, Password Change Modal
- **Shared Components**: `<Altcha />`, `ConfirmDialog`
- **Primary Navigation Location**: Topbar / Unauthenticated entry
- **Related Services**: `staffAuth.ts`, `parentService.ts`, `securityUtils.ts`
- **Related APIs**: `/api/v1/auth/login`, `/api/v1/parent/login`, `/api/v1/auth/mfa`, `/api/v1/auth/logout`
- **Verification Status**: Verified from source code.

---

## 2. Dashboard & Analytics Module
- **Module Name**: Executive & Operational Dashboard
- **Purpose**: Summary metrics, attendance tracking, SPP completion charts, quality alerts, watchlist.
- **Primary Personas**: `administrator`, `admin`, `teacher`
- **Entry Route**: `/dashboard`
- **Parent Module**: Root Navigation (`Utama`)
- **Child Pages**: None
- **Dialogs / Drawers**: Integrity Check Modal, Quick Action Drawers
- **Shared Components**: Metric Cards, Chart Containers, Alert Banners
- **Primary Navigation Location**: Sidebar Menu (`/dashboard`)
- **Related Services**: `dashboardService.ts`, `auditService.ts`
- **Related APIs**: `/api/v1/dashboards/school`, `/api/v1/dashboards/watchlist`
- **Verification Status**: Verified from source code.

---

## 3. Student Management Module
- **Module Name**: Student Management
- **Purpose**: Student directory, enrollment management, status changes (activate/suspend), parent PIN reset.
- **Primary Personas**: `administrator`, `admin`
- **Entry Route**: `/students`
- **Parent Module**: Academic & Classes (`akademik`)
- **Child Pages**: `/students/[id]`
- **Dialogs / Drawers**: Student Creation Modal, Edit Student Drawer, Reset PIN Dialog, Status Confirmation Dialog
- **Shared Components**: DataTable, Pagination, SearchBar, StatusBadge
- **Primary Navigation Location**: Sidebar Menu (`/students`)
- **Related Services**: `studentService.ts`
- **Related APIs**: `/api/v1/students`, `/api/v1/students/:id/status`, `/api/v1/students/:id/reset-pin`
- **Verification Status**: Verified from source code.

---

## 4. Teacher & Staff Management Module
- **Module Name**: Teacher & User Administration
- **Purpose**: Manage staff accounts, role assignment, password resets, active status toggles.
- **Primary Personas**: `administrator`
- **Entry Routes**: `/teachers`, `/users`
- **Parent Module**: Academic & System (`akademik`, `sistem`)
- **Child Pages**: None
- **Dialogs / Drawers**: User Creation Modal, Reset Password Modal, Role Assignment Drawer
- **Shared Components**: UserTable, RoleBadge, ActionDropdown
- **Primary Navigation Location**: Sidebar Menu (`/users`, `/teachers`)
- **Related Services**: `userService.ts`
- **Related APIs**: `/api/v1/users`, `/api/v1/users/:id/reset-password`, `/api/v1/users/:id/status`
- **Verification Status**: Verified from source code.

---

## 5. Classes & Class Subject Assignment Module
- **Module Name**: Academic Classes & Subject Mapping
- **Purpose**: Class creation, assigning homeroom teachers (Wali Kelas), mapping subjects to classes.
- **Primary Personas**: `administrator`
- **Entry Routes**: `/classes`, `/subjects`, `/classes/subjects`
- **Parent Module**: Academic & Classes (`akademik`)
- **Child Pages**: `/classes/[id]`
- **Dialogs / Drawers**: Create Class Modal, Assign Teacher Drawer, Map Subject Modal
- **Shared Components**: ClassGrid, SubjectList, MultiSelectDropdown
- **Primary Navigation Location**: Sidebar Menu (`/classes`, `/subjects`)
- **Related Services**: `classService.ts`, `subjectService.ts`
- **Related APIs**: `/api/v1/classes`, `/api/v1/class-subjects/my`
- **Verification Status**: Verified from source code.

---

## 6. Academic Assessment & Grading Module
- **Module Name**: Academic Scoring & Grade Roster
- **Purpose**: Input student scores per assessment date/subject, calculate averages, publish grades.
- **Primary Personas**: `teacher`
- **Entry Routes**: `/my-class`, `/academic-scores`
- **Parent Module**: Main Navigation (`Utama`)
- **Child Pages**: None
- **Dialogs / Drawers**: Grade Entry Drawer, Assessment Publish Confirmation Modal
- **Shared Components**: ScoreTable, GradeInputGrid, PublishBadge
- **Primary Navigation Location**: Sidebar Menu (`/academic-scores`, `/my-class`)
- **Related Services**: `academicScoreService.ts`
- **Related APIs**: `/api/v1/academic-assessments`, `/api/v1/academic-assessments/:id/scores`
- **Verification Status**: Verified from source code.

---

## 7. Daily Character Culture Module
- **Module Name**: Daily Character Culture & Character Recap
- **Purpose**: Evaluate daily character habits, generate character recaps, track student behavior metrics.
- **Primary Personas**: `teacher`
- **Entry Routes**: `/daily-culture`, `/character-recap`
- **Parent Module**: Main Navigation (`Utama`)
- **Child Pages**: None
- **Dialogs / Drawers**: Daily Culture Matrix Drawer
- **Shared Components**: CharacterScoreGrid, CultureRadarChart
- **Primary Navigation Location**: Sidebar Menu (`/daily-culture`, `/character-recap`)
- **Related Services**: `characterSummaryService.ts`
- **Related APIs**: `/api/v1/culture-scores`
- **Verification Status**: Verified from source code.

---

## 8. SPP Finance Module
- **Module Name**: SPP Financial Management
- **Purpose**: Track student SPP payment statuses, record single/bulk payments, revert payments, view arrears.
- **Primary Personas**: `administrator`, `admin`
- **Entry Route**: `/finance`
- **Parent Module**: System & Finance (`sistem`)
- **Child Pages**: None
- **Dialogs / Drawers**: Payment Verification Modal, Bulk Payment Drawer, Revert Payment Modal
- **Shared Components**: PaymentTable, ArrearsBadge, PaymentSummaryCard
- **Primary Navigation Location**: Sidebar Menu (`/finance`)
- **Related Services**: `financeService.ts`
- **Related APIs**: `/api/v1/finance/spp`, `/api/v1/finance/spp/verify`
- **Verification Status**: Verified from source code.

---

## 9. Settings & Rollover Module
- **Module Name**: Settings, Promotion Rules & Rollover
- **Purpose**: Configure promotion rules, execute student promotion, rollover subject assignments across terms.
- **Primary Personas**: `administrator`, `admin`
- **Entry Routes**: `/settings/promotion`, `/settings/rollover`
- **Parent Module**: Academic & System (`akademik`, `sistem`)
- **Child Pages**: None
- **Dialogs / Drawers**: Rollover Preview Modal, Promotion Execution Confirmation Modal
- **Shared Components**: PromotionRuleTable, PreviewDiffView
- **Primary Navigation Location**: Sidebar Menu (`/settings/promotion`, `/settings/rollover`)
- **Related Services**: `rolloverService.ts`, `promotionService.ts`
- **Related APIs**: `/api/v1/rollovers/assignments/preview`, `/api/v1/promotion-rules`
- **Verification Status**: Verified from source code.

---

## 10. CMS Landing Page Module
- **Module Name**: Website CMS & Landing Page Management
- **Purpose**: Manage landing page banners, announcements, features, testimonials, and footer content.
- **Primary Personas**: `administrator`, `admin`
- **Entry Route**: `/settings/cms-landing`
- **Parent Module**: Website CMS (`website`)
- **Child Pages**: None
- **Dialogs / Drawers**: Section Edit Drawer, Image Upload Modal
- **Shared Components**: SectionsTab, BannerEditor, PreviewCard
- **Primary Navigation Location**: Sidebar Menu (`/settings/cms-landing`)
- **Related Services**: `websiteConfigService.ts`
- **Related APIs**: `/api/v1/sections`, `/api/v1/website-config`
- **Verification Status**: Verified from source code.

---

## 11. Audit Log & Health Check Module
- **Module Name**: System Audit Logs & Health Diagnostics
- **Purpose**: Search security logs, inspect database latency, storage checks, and manual backup triggers.
- **Primary Personas**: `administrator`, `admin`
- **Entry Routes**: `/audit-log`, `/health-check`
- **Parent Module**: System (`sistem`)
- **Child Pages**: None
- **Dialogs / Drawers**: Log Detail Modal, System Diagnostic Drawer
- **Shared Components**: LogTable, HealthStatusBadge, MetricMeter
- **Primary Navigation Location**: Sidebar Menu (`/audit-log`, `/health-check`)
- **Related Services**: `auditService.ts`, `healthService.ts`
- **Related APIs**: `/api/v1/audit-logs`, `/api/v1/system/health/extended`
- **Verification Status**: Verified from source code.

---

## 12. Data Import & Export Module
- **Module Name**: Bulk Import & Export Data
- **Purpose**: Import student/score data via CSV, export academic, character, and financial reports.
- **Primary Personas**: `administrator`, `admin`, `teacher`
- **Entry Routes**: `/import`, `/export`
- **Parent Module**: Data & Integration (`data`)
- **Child Pages**: None
- **Dialogs / Drawers**: CSV Upload Modal, Export Filter Drawer
- **Shared Components**: FileUploader, ExportProgressMeter
- **Primary Navigation Location**: Sidebar Menu (`/import`, `/export`)
- **Related Services**: `importService.ts`, `exportService.ts`
- **Related APIs**: `/api/v1/imports`, `/api/v1/exports`
- **Verification Status**: Verified from source code.

---

## 13. Parent Portal Module
- **Module Name**: Parent Portal
- **Purpose**: View student progress, academic score cards, daily character assessments, and SPP payment status.
- **Primary Personas**: `parent`
- **Entry Routes**: `/parent/dashboard`, `/parent/academic`, `/parent/character`, `/parent/spp`
- **Parent Module**: Root (Dedicated Parent Portal)
- **Child Pages**: None
- **Dialogs / Drawers**: None
- **Shared Components**: ParentHeader, ScoreSummaryCard, SPPStatusBadge
- **Primary Navigation Location**: Topbar / Bottom Nav inside Parent Layout
- **Related Services**: `parentService.ts`
- **Related APIs**: `/api/v1/parent/dashboard`, `/api/v1/parent/character-detail`, `/api/v1/parent/spp-status`
- **Verification Status**: Verified from source code.
