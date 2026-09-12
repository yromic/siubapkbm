# RPM Embedded Attachment Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every page of authorized PDF attachments and actual PNG/JPEG attachments after the RPM signatures/footer in preview and browser-generated PDF output.

**Architecture:** A client-only `RPMAttachmentDocumentPages` owns protected-file loading, PDF.js rendering, image readiness, cancellation, and attachment-level retry. Pure helpers classify files and aggregate readiness; `PrintRenderer` places the component after the main footer and reports readiness to RPM/BLC print controls.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, `pdfjs-dist`, Node test runner, Chrome DevTools Protocol.

**Spec:** `docs/superpowers/specs/2026-09-12-rpm-embedded-attachment-pages-design.md`

## Global Constraints

- Add `pdfjs-dist` as the only new dependency; do not add `react-pdf`.
- Fetch private PDFs from existing same-origin authorized `previewUrl` endpoints as complete `ArrayBuffer` values.
- Embed only PDF, PNG, and JPEG; render explicit separate-file fallbacks for DOCX/XLSX.
- Place embedded content after main RPM signatures/footer.
- Do not change storage, database schema, attachment API contract, authorization, PDF merging, or main-document pagination.
- Cancel render tasks, destroy PDF documents, avoid stale state updates, and verify the bundled worker has no production 404.
- Preserve existing uncommitted preview UX/build-traceability changes already present in the worktree.

---

### Task 1: Install PDF.js and define renderer contracts

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/utils/rpmAttachmentRendering.ts`
- Create: `lib/utils/rpmAttachmentRendering.test.mjs`

**Interfaces:**
- Consumes: `RPMAttachment.mimeType`, `originalFilename`, and attachment render states.
- Produces: `EmbeddableAttachmentKind`, `AttachmentContentStatus`, `AttachmentPrintReadiness`, `classifyEmbeddableAttachment()`, and `summarizeAttachmentReadiness()`.

- [ ] **Step 1: Write failing classification and readiness tests**

```js
test("classifies only PDF, PNG, and JPEG as embeddable", () => {
  assert.equal(classifyEmbeddableAttachment("application/pdf"), "pdf");
  assert.equal(classifyEmbeddableAttachment("image/png"), "image");
  assert.equal(classifyEmbeddableAttachment("image/jpeg"), "image");
  assert.equal(classifyEmbeddableAttachment("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "external");
});

test("reports loading before error and ready only when every embeddable item is ready", () => {
  assert.equal(summarizeAttachmentReadiness([{ embeddable: true, status: "loading" }]).status, "loading");
  assert.equal(summarizeAttachmentReadiness([{ embeddable: true, status: "error" }]).status, "error");
  assert.equal(summarizeAttachmentReadiness([{ embeddable: true, status: "ready" }]).status, "ready");
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test --experimental-strip-types lib/utils/rpmAttachmentRendering.test.mjs`

Expected: FAIL because `rpmAttachmentRendering.ts` does not exist.

- [ ] **Step 3: Install the single dependency**

Run: `npm install pdfjs-dist`

Expected: only `pdfjs-dist` and its transitive lockfile entries are added.

- [ ] **Step 4: Implement the minimal pure contracts**

```ts
export type EmbeddableAttachmentKind = "pdf" | "image" | "external";
export type AttachmentContentStatus = "idle" | "loading" | "ready" | "error";
export type AttachmentPrintReadiness = "idle" | "loading" | "ready" | "error";

export function classifyEmbeddableAttachment(mimeType: string): EmbeddableAttachmentKind {
  const normalized = mimeType.toLowerCase();
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "image/png" || normalized === "image/jpeg") return "image";
  return "external";
}
```

Implement readiness so external-only/empty input is ready, any loading embeddable item wins while work remains, otherwise any error produces error, and all-ready produces ready with error/loading counts.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test --experimental-strip-types lib/utils/rpmAttachmentRendering.test.mjs`

Expected: all classification/readiness tests pass.

### Task 2: Build cancellable PDF/image attachment pages

**Files:**
- Create: `components/rpm/RPMAttachmentDocumentPages.tsx`
- Create: `components/rpm/pdfjsClient.ts`
- Modify: `app/globals.css`
- Test: `lib/utils/rpmAttachmentRendering.test.mjs`

**Interfaces:**
- Consumes: `attachments: RPMAttachment[]`, existing authorized `previewUrl` fields.
- Produces: `onReadinessChange(summary: AttachmentRenderSummary)`, the `rpm-lampiran` DOM target, actual PDF canvases/images, and per-attachment retry.

- [ ] **Step 1: Add a failing pagination-boundary helper test**

```js
test("does not request a page break after the final source page", () => {
  assert.equal(shouldBreakAfterPdfPage(0, 3), true);
  assert.equal(shouldBreakAfterPdfPage(1, 3), true);
  assert.equal(shouldBreakAfterPdfPage(2, 3), false);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test --experimental-strip-types lib/utils/rpmAttachmentRendering.test.mjs`

Expected: FAIL because `shouldBreakAfterPdfPage` is missing.

- [ ] **Step 3: Configure PDF.js using the installed worker artifact**

In `pdfjsClient.ts`, import the installed PDF.js build and set `GlobalWorkerOptions.workerSrc` from a bundler-resolved URL for the exact installed version, for example:

```ts
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export { pdfjs };
```

If the package export shape rejects that form, use `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()` and verify the emitted URL through the production browser network log. Do not use a CDN or guessed `/pdf.worker...` path.

- [ ] **Step 4: Implement protected PDF loading and complete page rendering**

For each PDF attachment:

```ts
const response = await fetch(attachment.previewUrl!, { credentials: "same-origin" });
if (!response.ok) throw new Error("ATTACHMENT_FETCH_FAILED");
const bytes = await response.arrayBuffer();
const loadingTask = pdfjs.getDocument({ data: bytes });
const pdf = await loadingTask.promise;
```

Render pages `1..pdf.numPages` at intrinsic scale `2`, set canvas pixel dimensions from the viewport, and use CSS width `100%`/height `auto`. Retain loading/render tasks, cancel them during cleanup, call `pdf.destroy()`, and gate every async state update with a generation token/active flag.

- [ ] **Step 5: Implement image and external-file branches**

Render PNG/JPEG with the authorized `previewUrl`, `credentials`-compatible same-origin loading, `max-width: 100%`, automatic height, `object-fit: contain`, and `onLoad`/`onError` readiness transitions. Render DOCX/XLSX/other types as explicit separate-file fallback text with title and original filename.

- [ ] **Step 6: Implement attachment retry and error UI**

Show `Lampiran gagal ditampilkan.` and safe filename for failed items. Retry increments only that attachment generation and re-fetches/re-renders it. Log module/document/attachment ID and operation without bytes, paths, or credentials.

- [ ] **Step 7: Add print CSS without a trailing unconditional break**

Use attachment-start boundaries and conditional PDF-page classes. Ensure `.rpm-attachment-pdf-page` has visible overflow and canvas/image width `100%`, height `auto`. Apply page breaks only where `shouldBreakAfterPdfPage(index, count)` returns true and use the next attachment boundary for inter-attachment separation.

- [ ] **Step 8: Run tests and lint the new component**

Run: `npm test`

Run: `npx eslint components/rpm/RPMAttachmentDocumentPages.tsx components/rpm/pdfjsClient.ts lib/utils/rpmAttachmentRendering.ts lib/utils/rpmAttachmentRendering.test.mjs`

Expected: tests pass and focused lint reports zero errors.

### Task 3: Move formal Lampiran after signatures and coordinate readiness

**Files:**
- Modify: `components/print/print-renderer.tsx`
- Modify: `components/rpm/RPMAttachmentPrintList.tsx` (remove from canonical print path; retain or delete only if no consumers remain)
- Modify: `app/(authenticated)/(modules)/rpm/page.tsx`
- Modify: `app/(authenticated)/(modules)/blc/page.tsx`
- Modify: `components/rpm/RPMAttachmentPreviewNotice.tsx`
- Modify: `lib/utils/attachmentPreview.ts`
- Test: `lib/utils/attachmentPreview.test.mjs`

**Interfaces:**
- Consumes: `AttachmentRenderSummary` from `RPMAttachmentDocumentPages`.
- Produces: `PrintRenderer.onAttachmentReadinessChange`, print loading/error UX, and retry/jump behavior targeting the actual embedded pages.

- [ ] **Step 1: Add failing print-decision tests**

```js
test("blocks print while embedded content is loading", () => {
  assert.equal(getAttachmentPrintDecision("loading"), "wait");
});

test("requires confirmation after an embedded render error", () => {
  assert.equal(getAttachmentPrintDecision("error"), "confirm");
  assert.equal(getAttachmentPrintDecision("ready"), "print");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test`

Expected: FAIL because `getAttachmentPrintDecision` is missing.

- [ ] **Step 3: Move the formal renderer after the main footer**

Remove `RPMAttachmentPrintList` from `.document-body`. After the signature/footer block, render `RPMAttachmentDocumentPages` only for RPM documents with attachments. Preserve main-document markup and ordering unchanged otherwise.

- [ ] **Step 4: Connect readiness to RPM and BLC print controls**

Store render readiness separately from attachment-list fetch status. Reset it when switching documents. While loading, do not call `window.print()` and show `Lampiran masih dimuat.` If error, require the existing lightweight confirmation. When ready, print normally.

- [ ] **Step 5: Point discoverability UI to actual content**

Keep the existing count from `activeDocAttachments`, but make `Lihat Lampiran` jump to the new post-signature `rpm-lampiran`. Show render-loading/error detail and retry without placing controls in printable output.

- [ ] **Step 6: Verify focused behavior**

Run: `npm test`

Run: `npx eslint components/print/print-renderer.tsx components/rpm/RPMAttachmentPreviewNotice.tsx lib/utils/attachmentPreview.ts`

Expected: unit tests pass; focused files have zero lint errors.

### Task 4: Browser acceptance with real and controlled fixtures

**Files:**
- No production file changes unless a test exposes a defect.
- Temporary fixtures must live outside the repository and be removed after use.

**Interfaces:**
- Consumes: running SIUBA dev server and authenticated Chrome CDP session.
- Produces: captured source-page count, canvas/image counts, network status, DOM order, cleanup evidence, and generated-PDF evidence.

- [ ] **Step 1: Verify the existing persisted LKPD without re-upload**

Use document `1e50ca0c-97be-4543-9b07-2ee11cd94d51`. Confirm the authorized preview request returns HTTP 200 and `application/pdf`, PDF.js reports its real `numPages`, the DOM has the same number of rendered canvases, and the first/last pages contain non-empty rendered pixels.

- [ ] **Step 2: Verify DOM order and worker delivery**

Assert the signature/footer rectangles precede `#rpm-lampiran`. Capture the PDF worker network request and require HTTP 200 with no worker 404/fake-worker fallback error.

- [ ] **Step 3: Verify one-page, three-page, image, and mixed rendering**

Use existing persisted attachments when available. If unavailable, create controlled development-only fixtures through the normal authorized upload API, record which cases required fixtures, and remove them through the normal delete API after testing. Confirm one-page PDF = one canvas, three-page PDF = three canvases, PNG/JPEG render complete images, and mixed inputs retain `sortOrder`.

- [ ] **Step 4: Verify corrupted and unauthorized failures**

Block/corrupt controlled development responses without weakening the route. Confirm the item-level error and retry appear, RPM remains visible, printing requires confirmation, and an unauthenticated request is rejected.

- [ ] **Step 5: Verify cancellation and switching**

Throttle PDF loading, leave preview, and switch to another RPM. Confirm no stale canvas/title appears, no state-after-unmount console error occurs, render tasks cancel, and the old PDF document is destroyed.

- [ ] **Step 6: Generate and inspect the final PDF**

Use Chrome `Page.printToPDF`. Confirm output page count increases by the embedded source pages, raster/image content exists on attachment pages after the RPM main-document pages, every source page is represented, the final page is non-blank, and no preview helper text is printed.

### Task 5: Repository verification and report

**Files:**
- Modify only files exposed by verification defects that are within this spec.

**Interfaces:**
- Consumes: completed implementation and browser evidence.
- Produces: final report with exact installed version, worker URL/status, fetch strategy, scale, cleanup, readiness, source/rendered page counts, and repository gate results.

- [ ] **Step 1: Run unit tests**

Run: `npm test`

Expected: all focused tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: zero new errors; if the repository still contains unrelated baseline failures, report their exact files/rules separately and run focused lint across every changed file.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`

Expected: zero new errors; document existing unrelated baseline errors separately rather than expanding scope.

- [ ] **Step 4: Run production build and verify worker asset**

Run: `npm run build`

Expected: compilation emits the PDF worker asset and the build completes unless blocked by documented pre-existing repository errors. Serve the production output when possible and confirm the emitted worker URL returns HTTP 200.

- [ ] **Step 5: Review scope and diff integrity**

Run: `git diff --check`

Run: `git status --short`

Confirm no storage, migration, authorization, AI, letterhead, KKTP, Trisula, or server-conversion changes entered the diff.
