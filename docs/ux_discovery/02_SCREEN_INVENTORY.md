# Observable Screen Inventory

This document lists every screen/view discovered within the application source code.

---

## 1. Authentication Screens

### Screen: Staff Login (`/login`)
- **Route**: `/login`
- **Module**: Authentication & Security
- **Primary User**: `administrator`, `admin`, `teacher`
- **Accessible From**: Direct URL / Session expiration redirect
- **Main Components**: `<Altcha />`, LoginForm Card, Header Logo
- **Forms**: Username/Email & Password Form
- **Tables / Charts**: None
- **Dialogs / Drawers**: MFA Challenge Modal (Inline state)
- **Filters / Search**: None
- **Pagination**: None
- **Actions**: Submit Login
- **Export / Import**: None
- **Breadcrumb**: None
- **Tabs**: None
- **Verification Status**: Verified.

### Screen: Parent Login (`/parent/login`)
- **Route**: `/parent/login`
- **Module**: Parent Portal
- **Primary User**: `parent`
- **Accessible From**: Direct URL
- **Main Components**: `<Altcha />`, ParentLoginForm Card
- **Forms**: NISN, Birth Date, PIN Form
- **Tables / Charts**: None
- **Dialogs / Drawers**: None
- **Filters / Search**: None
- **Pagination**: None
- **Actions**: Submit Parent Login
- **Export / Import**: None
- **Breadcrumb**: None
- **Tabs**: None
- **Verification Status**: Verified.

---

## 2. Staff Portal Screens

### Screen: Executive Dashboard (`/dashboard`)
- **Route**: `/dashboard`
- **Module**: Dashboard & Analytics
- **Primary User**: `administrator`, `admin`, `teacher`
- **Accessible From**: Main Navigation
- **Main Components**: StatCards, SPPChart, FitrahRadarChart, WatchlistTable
- **Forms**: None
- **Tables**: Watchlist Table
- **Cards**: Summary Stat Cards
- **Charts**: Recharts SPP Bar Chart, Fitrah Radar Chart
- **Dialogs / Drawers**: Integrity Check Modal
- **Filters / Search**: None
- **Pagination**: None
- **Actions**: Trigger Manual Integrity Check
- **Export / Import**: None
- **Breadcrumb**: Dashboard
- **Tabs**: Overview Tab, Watchlist Tab
- **Verification Status**: Verified.

### Screen: Student Directory (`/students`)
- **Route**: `/students`
- **Module**: Student Management
- **Primary User**: `administrator`, `admin`
- **Accessible From**: Sidebar Navigation (`/students`)
- **Main Components**: StudentTable, SearchFilterHeader, ActionMenu
- **Forms**: Inline Search Input
- **Tables**: Student Data Table
- **Cards**: Summary Metrics Card
- **Charts**: None
- **Dialogs / Drawers**: Student Creation Drawer, Edit Student Drawer, Reset PIN Dialog
- **Filters / Search**: Filter by Status, Filter by Class, Search Name/NISN
- **Pagination**: Standard Table Pagination
- **Actions**: Add Student, Edit Student, Reset Parent PIN, Change Status
- **Export / Import**: Export Selected, Import CSV Link
- **Breadcrumb**: Dashboard > Siswa
- **Tabs**: None
- **Verification Status**: Verified.

### Screen: Teacher & Staff Management (`/teachers` & `/users`)
- **Routes**: `/teachers`, `/users`
- **Module**: Teacher & User Administration
- **Primary User**: `administrator`
- **Accessible From**: Sidebar Navigation
- **Main Components**: UserTable, UserFormDrawer, ResetPasswordDialog
- **Forms**: User Creation Form, Password Reset Form
- **Tables**: Users Data Table
- **Cards**: Role Count Cards
- **Charts**: None
- **Dialogs / Drawers**: Add User Drawer, Reset Password Modal
- **Filters / Search**: Role Filter, Search Username/Email
- **Pagination**: Standard Table Pagination
- **Actions**: Add User, Edit User, Reset Password, Toggle Active Status
- **Export / Import**: None
- **Breadcrumb**: Dashboard > Pengguna
- **Tabs**: None
- **Verification Status**: Verified.

### Screen: Classes & Subject Mapping (`/classes`, `/subjects`, `/classes/subjects`)
- **Routes**: `/classes`, `/subjects`, `/classes/subjects`
- **Module**: Classes & Subject Mapping
- **Primary User**: `administrator`
- **Accessible From**: Sidebar Navigation
- **Main Components**: ClassGrid, SubjectTable, AssignmentMatrix
- **Forms**: Class Form, Subject Form
- **Tables**: Class List, Subject List, Class-Subject Mapping Table
- **Cards**: Class Summary Card
- **Charts**: None
- **Dialogs / Drawers**: Add Class Modal, Assign Homeroom Teacher Drawer, Subject Mapping Modal
- **Filters / Search**: Filter by Academic Year, Filter by Grade Level
- **Pagination**: Standard Pagination
- **Actions**: Add Class, Assign Wali Kelas, Map Subjects
- **Export / Import**: None
- **Breadcrumb**: Dashboard > Kelas
- **Tabs**: Kelas, Mata Pelajaran, Mapping Mapel
- **Verification Status**: Verified.

### Screen: Academic Score Entry (`/academic-scores` & `/my-class`)
- **Routes**: `/academic-scores`, `/my-class`
- **Module**: Academic Assessment & Grading
- **Primary User**: `teacher`
- **Accessible From**: Sidebar Navigation
- **Main Components**: ScoreGridInput, AssessmentDatePicker, CompletenessBadge
- **Forms**: Inline Grade Grid Input Form
- **Tables**: Score Roster Table
- **Cards**: Assessment Summary Card
- **Charts**: Grade Distribution Chart
- **Dialogs / Drawers**: Assessment Creation Drawer, Publish Confirmation Modal
- **Filters / Search**: Select Class, Select Subject, Select Date
- **Pagination**: None (Roster view)
- **Actions**: Save Scores, Publish Assessment
- **Export / Import**: Export Score Roster CSV
- **Breadcrumb**: Dashboard > Nilai Akademik
- **Tabs**: Input Nilai, Rekap Nilai
- **Verification Status**: Verified.

### Screen: Daily Culture & Character Recap (`/daily-culture` & `/character-recap`)
- **Routes**: `/daily-culture`, `/character-recap`
- **Module**: Daily Character Culture
- **Primary User**: `teacher`
- **Accessible From**: Sidebar Navigation
- **Main Components**: CultureHabitGrid, CharacterRadarChart, WatchlistBadge
- **Forms**: Daily Habit Checkbox Grid
- **Tables**: Character Recap Table
- **Cards**: Student Character Summary Card
- **Charts**: Character Fitrah Radar Chart
- **Dialogs / Drawers**: Habit Detail Modal
- **Filters / Search**: Select Date, Select Class
- **Pagination**: None
- **Actions**: Save Culture Scores
- **Export / Import**: Export Character Summary CSV
- **Breadcrumb**: Dashboard > Budaya Harian
- **Tabs**: Input Budaya, Rekap Karakter
- **Verification Status**: Verified.

### Screen: SPP Financial Management (`/finance`)
- **Route**: `/finance`
- **Module**: SPP Finance
- **Primary User**: `administrator`, `admin`
- **Accessible From**: Sidebar Navigation (`/finance`)
- **Main Components**: SPPPaymentTable, ArrearsSummaryList, PaymentVerificationModal
- **Forms**: Payment Amount & Method Form
- **Tables**: SPP Payment Roster, Arrears Summary Table
- **Cards**: Financial Health Card, Monthly Collection Metric
- **Charts**: Monthly SPP Collection Bar Chart
- **Dialogs / Drawers**: Verify Payment Modal, Bulk Payment Drawer, Revert Payment Modal
- **Filters / Search**: Filter by Class, Filter by Month/Year, Filter Payment Status
- **Pagination**: Standard Table Pagination
- **Actions**: Verify Payment, Record Bulk Payment, Revert Payment
- **Export / Import**: Export SPP Report CSV
- **Breadcrumb**: Dashboard > Keuangan (SPP)
- **Tabs**: Status Pembayaran, Tunggakan SPP, Riwayat Transaksi
- **Verification Status**: Verified.

### Screen: Settings & Rollover (`/settings/promotion` & `/settings/rollover`)
- **Routes**: `/settings/promotion`, `/settings/rollover`
- **Module**: Settings & Rollover
- **Primary User**: `administrator`, `admin`
- **Accessible From**: Sidebar Navigation
- **Main Components**: PromotionRulesList, RolloverPreviewDiff, ExecutionProgress
- **Forms**: Promotion Rule Form, Rollover Target Form
- **Tables**: Promotion Rules Table, Rollover Preview Table
- **Cards**: Period Readiness Card
- **Charts**: None
- **Dialogs / Drawers**: Execute Promotion Modal, Rollover Preview Modal
- **Filters / Search**: Target Academic Year Select
- **Pagination**: None
- **Actions**: Save Rule, Execute Promotion, Execute Rollover
- **Export / Import**: None
- **Breadcrumb**: Dashboard > Pengaturan
- **Tabs**: Kenaikan Kelas, Salin Pengaturan (Rollover)
- **Verification Status**: Verified.

### Screen: CMS Landing Page Management (`/settings/cms-landing`)
- **Route**: `/settings/cms-landing`
- **Module**: Website CMS
- **Primary User**: `administrator`, `admin`
- **Accessible From**: Sidebar Navigation
- **Main Components**: SectionsTab, BannerEditor, PreviewCard
- **Forms**: Section Content Form, Image Upload Input
- **Tables**: Section List Table
- **Cards**: Live Preview Card
- **Charts**: None
- **Dialogs / Drawers**: Add/Edit Section Drawer, Media Upload Modal
- **Filters / Search**: Search Sections
- **Pagination**: None
- **Actions**: Save Section, Toggle Section Visibility, Reorder Sections
- **Export / Import**: None
- **Breadcrumb**: Dashboard > CMS Landing Page
- **Tabs**: Banners, Announcements, Features, Testimonials, Footer
- **Verification Status**: Verified.

### Screen: System Audit Logs (`/audit-log`)
- **Route**: `/audit-log`
- **Module**: Audit Log & Health Check
- **Primary User**: `administrator`
- **Accessible From**: Sidebar Navigation
- **Main Components**: AuditLogTable, LogFilterHeader, LogDetailModal
- **Forms**: Search Filter Inputs
- **Tables**: Audit Logs Table
- **Cards**: Security Event Metric Cards
- **Charts**: None
- **Dialogs / Drawers**: Log Detail Inspector Modal
- **Filters / Search**: Filter by Action, Filter by User, Date Range Picker
- **Pagination**: Standard Table Pagination
- **Actions**: Inspect Log Detail, Clear Filters
- **Export / Import**: Export Audit Logs CSV
- **Breadcrumb**: Dashboard > Audit Log
- **Tabs**: None
- **Verification Status**: Verified.

### Screen: System Diagnostics & Health Check (`/health-check`)
- **Route**: `/health-check`
- **Module**: Audit Log & Health Check
- **Primary User**: `administrator`, `admin`
- **Accessible From**: Sidebar Navigation
- **Main Components**: SystemStatusBadge, DatabaseLatencyMeter, DiagnosticsReport
- **Forms**: None
- **Tables**: Database Table Count Summary
- **Cards**: DB Latency Card, Storage Status Card, Backup Status Card
- **Charts**: Uptime Gauge
- **Dialogs / Drawers**: Trigger Manual Backup Modal, Run Diagnostics Modal
- **Filters / Search**: None
- **Pagination**: None
- **Actions**: Run Database Integrity Check, Run Storage Integrity Check, Create Backup
- **Export / Import**: Download Diagnostics CSV
- **Breadcrumb**: Dashboard > Health Check
- **Tabs**: Ringkasan Sistem, Integritas Database, Storage, Backup
- **Verification Status**: Verified.

---

## 3. Parent Portal Screens

### Screen: Parent Dashboard (`/parent/dashboard`)
- **Route**: `/parent/dashboard`
- **Module**: Parent Portal
- **Primary User**: `parent`
- **Accessible From**: Parent Login
- **Main Components**: ParentHeaderCard, QuickNavGrid, AcademicOverviewCard, CharacterSummaryCard, SPPStatusCard
- **Forms**: None
- **Tables**: Recent Grades Summary Table
- **Cards**: Student Info Card, SPP Status Badge
- **Charts**: Character Fitrah Radar Chart
- **Dialogs / Drawers**: None
- **Filters / Search**: Period Selector Dropdown
- **Pagination**: None
- **Actions**: Navigate to Academic Detail, Navigate to SPP Detail
- **Export / Import**: None
- **Breadcrumb**: Beranda Parent
- **Tabs**: None
- **Verification Status**: Verified.
