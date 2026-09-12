import assert from "node:assert/strict";
import test from "node:test";

import {
  getAttachmentRenderGenerationKey,
  getSafeAttachmentFileTypeLabel,
  isCurrentAttachmentRenderGeneration,
  resetPdfPageContainer,
} from "./rpmAttachmentRendererLifecycle.ts";

test("keeps a value-equivalent attachment in the same render generation", () => {
  const attachment = {
    id: "attachment-1",
    mimeType: "application/pdf",
    previewUrl: "/api/v1/rpm/document-1/attachments/attachment-1",
  };
  const refetchedAttachment = { ...attachment };

  assert.equal(
    getAttachmentRenderGenerationKey(attachment, 0),
    getAttachmentRenderGenerationKey(refetchedAttachment, 0),
  );
  assert.notEqual(
    getAttachmentRenderGenerationKey(attachment, 0),
    getAttachmentRenderGenerationKey(attachment, 1),
  );
  assert.notEqual(
    getAttachmentRenderGenerationKey({ ...attachment, documentId: "document-2" }, 0),
    getAttachmentRenderGenerationKey({ ...attachment, documentId: "document-3" }, 0),
  );
});

test("clears previous PDF canvases before a value-equivalent rerender", () => {
  const sourcePageCount = 3;
  const pages = ["old-page-1", "old-page-2", "old-page-3"];
  const container = {
    replaceChildren() {
      pages.length = 0;
    },
  };

  resetPdfPageContainer(container);
  pages.push("new-page-1", "new-page-2", "new-page-3");

  assert.deepEqual(pages, ["new-page-1", "new-page-2", "new-page-3"]);
  assert.equal(pages.length, sourcePageCount);
});

test("rejects stale image events after refresh, switch, unmount, and retry", () => {
  const refreshGeneration = 4;
  assert.equal(isCurrentAttachmentRenderGeneration(refreshGeneration, refreshGeneration), true);

  const switchedGeneration = 5;
  assert.equal(isCurrentAttachmentRenderGeneration(switchedGeneration, refreshGeneration), false);

  assert.equal(isCurrentAttachmentRenderGeneration(null, switchedGeneration), false);

  const retryGeneration = 6;
  assert.equal(isCurrentAttachmentRenderGeneration(retryGeneration, switchedGeneration), false);
  assert.equal(isCurrentAttachmentRenderGeneration(retryGeneration, retryGeneration), true);
});

test("uses a known safe label for unsupported file types", () => {
  assert.equal(
    getSafeAttachmentFileTypeLabel(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "modul.docx",
    ),
    "DOCX",
  );
  assert.equal(getSafeAttachmentFileTypeLabel("text/plain", "untrusted.<script>"), "Berkas lain");
});
