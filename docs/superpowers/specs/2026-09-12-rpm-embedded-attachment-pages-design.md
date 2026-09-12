# RPM Embedded Attachment Pages Design

## Goal

Render the actual contents of persisted PDF, PNG, and JPEG RPM attachments inside Document Preview and browser-generated print/PDF output, after the RPM main-document signatures and footer, while preserving private authorization and existing attachment management.

## Scope

The MVP embeds `application/pdf`, `image/png`, and `image/jpeg`. DOCX and XLSX remain separate files and receive an explicit formal fallback stating that they cannot be embedded. The work does not change upload, storage, database schema, attachment metadata, authorization rules, RPM pedagogical content, AI, letterhead behavior, KKTP, Trisula, or introduce server-side PDF merging/conversion.

## Dependency Decision

The repository contains `pdfmake`, which generates PDFs but does not render arbitrary uploaded PDFs. No PDF.js renderer is installed. Add `pdfjs-dist` as the only new dependency and use its browser API directly; do not add `react-pdf`.

The implementation must inspect the installed `pdfjs-dist` version and configure `GlobalWorkerOptions.workerSrc` using a Next.js-compatible bundled worker URL. Production verification must prove that the worker asset loads without a 404. No assumed CDN or default worker path is permitted.

## Component Architecture

Create `RPMAttachmentDocumentPages`, a client-only presentational component mounted only while an RPM preview is open. It accepts the already-loaded, sort-ordered attachment contract and reports aggregate render readiness to the owning preview page.

Responsibilities:

- Sort attachments by `sortOrder`.
- Classify formats primarily by server-validated `mimeType`.
- Fetch authorized PDF bytes and render all pages.
- Render authorized PNG/JPEG content without cropping or distortion.
- Render an explicit non-embedded fallback for DOCX/XLSX and other unsupported types.
- Track per-attachment `idle`, `loading`, `ready`, or `error` state.
- Expose retry for failed embeddable content.
- Cancel work and release resources on unmount or attachment/document change.
- Report aggregate loading, ready, and error counts for print coordination.

`RPMAttachmentPrintList` will no longer be the formal metadata-only output. The stable `rpm-lampiran` target moves to the new component. A compact attachment heading may show title/type immediately before actual content, but filenames alone never satisfy embedded PDF/image rendering.

## Final Document Order

`PrintRenderer` retains the natural RPM main-document layout:

1. Letterhead and RPM main content.
2. Main RPM signatures.
3. SIUBA main-document footer.
4. `LAMPIRAN` heading.
5. Actual attachment contents in attachment `sortOrder` and source-PDF page order.

The attachment section is omitted when there are no attachments. SIUBA letterhead/footer is not overlaid or repeated on uploaded content.

## Authorized File Fetching

PDF.js receives bytes fetched from the existing same-origin `previewUrl` using `fetch(url, { credentials: "same-origin" })`, followed by `response.arrayBuffer()`. Non-OK responses become attachment render errors. No public URLs, authorization bypasses, range API changes, third-party viewers, or file-content logging are introduced.

Images use the same authorized preview URL. Because it is same-origin, normal browser credentials accompany the request. Image readiness comes from `onLoad`/`onError`.

## PDF Rendering

Each PDF page is loaded through PDF.js and rendered to its own canvas. The renderer uses an intrinsic scale suitable for A4 printing (target scale around `2`, adjusted only if measurements show excessive memory or insufficient readability), while CSS sets `width: 100%`, `height: auto`, and preserves the source page aspect ratio and orientation. Canvas pixel dimensions and CSS display dimensions remain separate.

All source pages are rendered, including PDFs with at least three pages. The component displays a lightweight loading state until the document and pages finish rendering, and an attachment-specific error without crashing the RPM preview when fetching, parsing, or rendering fails.

## Images and Unsupported Files

PNG and JPEG attachments render as actual `<img>` content with `max-width: 100%`, automatic height, `object-fit: contain`, and no fixed-height clipping. Portrait and landscape images preserve their original proportions.

DOCX, XLSX, and other non-embeddable formats render a formal fallback containing the attachment number/title, file type/name, and the statement that the document is available as a separate file. Existing manager Preview and Download actions remain unchanged.

## Pagination

Each attachment begins at a clear attachment boundary after the main RPM footer. PDF source pages receive print page boundaries between pages. Attachment boundaries also separate multiple attachments. CSS must not apply an unconditional final `break-after: page`; the final embedded page must not create a blank trailing page. Main RPM pagination remains natural and has no fixed page count.

## Lifecycle and Cleanup

Every PDF render task is retained so it can be cancelled when the component unmounts or attachments/document change. Loaded PDF document proxies are destroyed. Any created object URLs are revoked; the preferred ArrayBuffer path should avoid object URLs entirely. Async completion handlers check an active generation token before setting React state. Switching RPMs invalidates the old generation, cancels page rendering, destroys old PDF resources, and prevents stale results from entering the new preview.

## Print Readiness

The embedded renderer reports aggregate readiness for embeddable attachments:

- `loading`: at least one PDF/image is fetching, parsing, rendering, or loading.
- `ready`: all embeddable attachments are fully rendered.
- `error`: at least one embeddable attachment failed.

The RPM and RPM-capable BLC print controls consume this state. While loading, printing does not start and the user sees `Lampiran masih dimuat.` If errors exist, the preview shows the failed attachment and retry control; printing requires a lightweight confirmation that the result will be incomplete. A successful retry clears the warning only after all embeddable content is ready. Printing is never permanently blocked.

The existing attachment-list fetch status remains distinct from embedded-content render readiness.

## Performance and Safety

Attachment contents load only in an open preview, never for every list card. The existing 10 MB upload limit bounds full-file PDF fetching. No arbitrary tiny page-count limit is added for the MVP. Rendering proceeds page-by-page and cleanup prevents abandoned work from consuming resources. If practical testing reveals a freeze risk within the existing 10 MB boundary, the implementation must stop and report evidence before introducing a page-count guard.

## Error Handling and Logging

User-visible errors remain generic: `Lampiran gagal ditampilkan.` plus the safe original filename. Fetch, PDF parse, page-render, and image-load failures are logged with module, document/attachment identifier, operation, and error; file contents, filesystem paths, tokens, and raw sensitive responses are never logged.

## Testing Strategy

Implementation follows test-first development. Pure format classification, aggregate readiness, pagination decisions, and stale-generation behavior receive focused automated tests. Browser-level tests exercise the real preview and authenticated file route.

Required evidence:

- Existing persisted `LKPD Informatika Kelas 10.pdf` embeds without re-upload.
- Authenticated bytes are successfully fetched.
- Source PDF page count equals rendered canvas count.
- One-page and at-least-three-page PDFs render every page.
- PNG and JPEG render actual pixels with preserved aspect ratio.
- PDF plus image attachments retain attachment order.
- Corrupted PDF displays an error and leaves the RPM usable.
- Unauthorized/file-fetch failure displays an error and cannot bypass authorization.
- Leaving preview and switching RPM during rendering cancel/destroy old work without stale state updates.
- DOCX/XLSX display the explicit non-embedded fallback.
- Chrome-generated final PDF contains visually rendered attachment pages after the RPM signatures/footer.
- The print-only output omits preview controls and has no trailing blank page caused by unconditional page-break CSS.
- Existing Preview/Download behavior remains available.

## Acceptance Boundary

Metadata or filenames alone do not satisfy acceptance. The user must visibly see every page of the existing LKPD PDF inside the RPM preview after signatures and inside the final browser-generated PDF. No database migration, server PDF binary, LibreOffice, Chromium server, ImageMagick, Poppler, public file exposure, iframe/object/embed print workaround, or backend PDF merge is permitted.
