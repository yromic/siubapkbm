# Observable Workflow Inventory

This inventory documents all end-to-end user workflows discovered within the SIUBA PKBM source code.

---

## 1. Authentication & MFA Workflow
- **Workflow Name**: Staff Authentication & MFA Enforcement
- **Starting Screen**: Staff Login (`/login`)
- **Ending Screen**: Staff Portal (`/dashboard` or `/portal`)
- **Primary Personas**: `administrator`, `admin`, `teacher`
- **Business Goal**: Securely authenticate staff and enforce multi-factor TOTP for privileged administrator roles.
- **Required Preconditions**: Active staff record, solved ALTCHA challenge (if attempt threshold hit).
- **Screens Traversed**: `/login` $\rightarrow$ (MFA Modal if required) $\rightarrow$ `/dashboard`
- **Dialogs**: MFA Challenge Modal
- **Confirmation Steps**: TOTP Passcode entry verification
- **Success State**: Session cookie issued (`staff_session_token`), redirected to `/dashboard`.
- **Failure State**: `ERR_INVALID_CREDENTIALS`, `ERR_ALTCHA_REQUIRED`, or `ERR_ACCOUNT_LOCKED` error displayed.
- **Related Services**: `staffAuth.ts`
- **Related APIs**: `/api/v1/auth/login`, `/api/v1/auth/mfa`
- **Verification Status**: Verified from source code.

---

## 2. Parent Login Workflow
- **Workflow Name**: Parent Access Portal Login
- **Starting Screen**: Parent Login (`/parent/login`)
- **Ending Screen**: Parent Dashboard (`/parent/dashboard`)
- **Primary Personas**: `parent`
- **Business Goal**: Grant parents access to their child's academic, character, and financial status.
- **Required Preconditions**: Student record exists with valid NISN, birth date, and configured parent PIN.
- **Screens Traversed**: `/parent/login` $\rightarrow$ `/parent/dashboard`
- **Dialogs**: None
- **Confirmation Steps**: PIN verification
- **Success State**: Session cookie issued (`parent_session_token`), redirected to `/parent/dashboard`.
- **Failure State**: `ERR_UNAUTHORIZED` error message displayed.
- **Related Services**: `parentService.ts`
- **Related APIs**: `/api/v1/parent/login`
- **Verification Status**: Verified from source code.

---

## 3. Student Creation & Enrollment Workflow
- **Workflow Name**: Create & Enroll New Student
- **Starting Screen**: Student Directory (`/students`)
- **Ending Screen**: Student Directory (`/students`)
- **Primary Personas**: `administrator`, `admin`
- **Business Goal**: Register a new student and enroll them into an active class.
- **Required Preconditions**: Active academic year and active class exist.
- **Screens Traversed**: `/students` $\rightarrow$ Student Creation Drawer $\rightarrow$ `/students`
- **Dialogs**: Student Creation Drawer, Class Assignment Modal
- **Confirmation Steps**: Submit Form
- **Success State**: New student record inserted into `students` table, `student_enrollments` linked, success toast shown.
- **Failure State**: Field validation error displayed inline.
- **Related Services**: `studentService.ts`
- **Related APIs**: `/api/v1/students`, `/api/v1/enrollments`
- **Verification Status**: Verified from source code.

---

## 4. Academic Score Entry & Publishing Workflow
- **Workflow Name**: Input & Publish Academic Assessment Scores
- **Starting Screen**: Academic Scores (`/academic-scores` or `/my-class`)
- **Ending Screen**: Academic Scores (`/academic-scores`)
- **Primary Personas**: `teacher`
- **Business Goal**: Record subject scores for students and publish them for parent access.
- **Required Preconditions**: Teacher assigned to class and subject for active period.
- **Screens Traversed**: `/my-class` $\rightarrow$ Assessment Date Select $\rightarrow$ Score Roster Input $\rightarrow$ Publish Modal
- **Dialogs**: Publish Confirmation Modal
- **Confirmation Steps**: Confirm Publish Modal
- **Success State**: Scores saved to `academic_scores`, assessment `is_published` set to `true`, parent portal updated.
- **Failure State**: Validation error on out-of-range scores (e.g. > 100).
- **Related Services**: `academicScoreService.ts`
- **Related APIs**: `/api/v1/academic-assessments`, `/api/v1/academic-assessments/:id/scores`
- **Verification Status**: Verified from source code.

---

## 5. Daily Culture & Character Evaluation Workflow
- **Workflow Name**: Record Daily Character Culture Assessment
- **Starting Screen**: Daily Culture (`/daily-culture`)
- **Ending Screen**: Daily Culture (`/daily-culture`)
- **Primary Personas**: `teacher`
- **Business Goal**: Evaluate student daily character habits across fitrah indicators.
- **Required Preconditions**: Active class roster for date.
- **Screens Traversed**: `/daily-culture` $\rightarrow$ Habit Checkbox Grid $\rightarrow$ Save
- **Dialogs**: None
- **Confirmation Steps**: Click Save Culture Scores
- **Success State**: Records inserted/updated in `culture_scores`, character recap chart updated.
- **Failure State**: Network error notification.
- **Related Services**: `characterSummaryService.ts`
- **Related APIs**: `/api/v1/culture-scores`
- **Verification Status**: Verified from source code.

---

## 6. SPP Payment Verification Workflow
- **Workflow Name**: Verify Student SPP Payment
- **Starting Screen**: SPP Finance (`/finance`)
- **Ending Screen**: SPP Finance (`/finance`)
- **Primary Personas**: `administrator`, `admin`
- **Business Goal**: Record or verify monthly SPP payment for a student.
- **Required Preconditions**: Student enrolled in active class.
- **Screens Traversed**: `/finance` $\rightarrow$ Verify Payment Modal $\rightarrow$ `/finance`
- **Dialogs**: Payment Verification Modal
- **Confirmation Steps**: Select Payment Method & Click Verify
- **Success State**: `spp_payments` table updated to `paid`, transaction logged, arrears list updated.
- **Failure State**: Invalid amount or duplicate payment error.
- **Related Services**: `financeService.ts`
- **Related APIs**: `/api/v1/finance/spp/verify`
- **Verification Status**: Verified from source code.

---

## 7. Period Rollover & Academic Setup Workflow
- **Workflow Name**: Execute Period Rollover & Settings Copy
- **Starting Screen**: Salin Pengaturan (`/settings/rollover`)
- **Ending Screen**: Salin Pengaturan (`/settings/rollover`)
- **Primary Personas**: `administrator`
- **Business Goal**: Copy class subject assignments and teacher mappings from previous term to new academic term.
- **Required Preconditions**: Source and target academic terms defined.
- **Screens Traversed**: `/settings/rollover` $\rightarrow$ Preview Diff Modal $\rightarrow$ Execute Confirmation Modal
- **Dialogs**: Rollover Preview Modal, Execution Confirmation Modal
- **Confirmation Steps**: Type target term name to confirm execution
- **Success State**: Batch insert into `class_subject_teachers`, readiness status updated to `healthy`.
- **Failure State**: Conflicting assignment error reported in preview diff.
- **Related Services**: `rolloverService.ts`
- **Related APIs**: `/api/v1/rollovers/assignments/preview`, `/api/v1/rollovers/assignments/execute`
- **Verification Status**: Verified from source code.

---

## 8. System Diagnostics & Manual Backup Workflow
- **Workflow Name**: Trigger Manual Database Snapshot Backup
- **Starting Screen**: Health Check (`/health-check`)
- **Ending Screen**: Health Check (`/health-check`)
- **Primary Personas**: `administrator`
- **Business Goal**: Execute an immediate database snapshot backup for disaster recovery preparedness.
- **Required Preconditions**: Storage write permissions present.
- **Screens Traversed**: `/health-check` $\rightarrow$ Trigger Backup Modal $\rightarrow$ `/health-check`
- **Dialogs**: Trigger Backup Modal
- **Confirmation Steps**: Click Create Snapshot
- **Success State**: Backup file written to storage, `backups` table record created, UI updated.
- **Failure State**: Storage directory missing error displayed.
- **Related Services**: `healthService.ts`, `backupService.ts`
- **Related APIs**: `/api/v1/backups`, `/api/v1/system/health/extended`
- **Verification Status**: Verified from source code.
