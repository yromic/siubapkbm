import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyEmbeddableAttachment,
  shouldBreakAfterPdfPage,
  summarizeAttachmentReadiness,
} from "./rpmAttachmentRendering.ts";

test("classifies only PDF, PNG, and JPEG as embeddable", () => {
  assert.equal(classifyEmbeddableAttachment("application/pdf"), "pdf");
  assert.equal(classifyEmbeddableAttachment("image/png"), "image");
  assert.equal(classifyEmbeddableAttachment("image/jpeg"), "image");
  assert.equal(
    classifyEmbeddableAttachment(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    "external",
  );
});

test("reports loading before error and ready only when every embeddable item is ready", () => {
  assert.equal(
    summarizeAttachmentReadiness([{ embeddable: true, status: "loading" }]).status,
    "loading",
  );
  assert.equal(
    summarizeAttachmentReadiness([{ embeddable: true, status: "error" }]).status,
    "error",
  );
  assert.equal(
    summarizeAttachmentReadiness([{ embeddable: true, status: "ready" }]).status,
    "ready",
  );
});

test("treats external-only and empty attachment lists as ready", () => {
  assert.deepEqual(
    summarizeAttachmentReadiness([{ embeddable: false, status: "idle" }]),
    { status: "ready", embeddableCount: 0, readyCount: 0, loadingCount: 0, errorCount: 0 },
  );
  assert.deepEqual(summarizeAttachmentReadiness([]), {
    status: "ready",
    embeddableCount: 0,
    readyCount: 0,
    loadingCount: 0,
    errorCount: 0,
  });
});

test("includes embeddable loading and error counts in the summary", () => {
  assert.deepEqual(
    summarizeAttachmentReadiness([
      { embeddable: true, status: "ready" },
      { embeddable: true, status: "loading" },
      { embeddable: true, status: "error" },
    ]),
    { status: "loading", embeddableCount: 3, readyCount: 1, loadingCount: 1, errorCount: 1 },
  );
});

test("does not request a page break after the final source page", () => {
  assert.equal(shouldBreakAfterPdfPage(0, 3), true);
  assert.equal(shouldBreakAfterPdfPage(1, 3), true);
  assert.equal(shouldBreakAfterPdfPage(2, 3), false);
});
