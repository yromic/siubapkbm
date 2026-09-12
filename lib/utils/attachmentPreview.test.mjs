import assert from "node:assert/strict";
import test from "node:test";

import {
  getAttachmentPreviewMessage,
  getAttachmentPrintDecision,
  shouldConfirmAttachmentPrint,
} from "./attachmentPreview.ts";

test("omits the preview notice when there are no attachments", () => {
  assert.equal(getAttachmentPreviewMessage(0), null);
});

test("uses the same Indonesian label for one or many attachments", () => {
  assert.equal(getAttachmentPreviewMessage(1), "1 lampiran tersedia di bagian akhir dokumen.");
  assert.equal(getAttachmentPreviewMessage(3), "3 lampiran tersedia di bagian akhir dokumen.");
});

test("asks for print confirmation only after attachment loading fails", () => {
  assert.equal(shouldConfirmAttachmentPrint("error"), true);
  assert.equal(shouldConfirmAttachmentPrint("success"), false);
  assert.equal(shouldConfirmAttachmentPrint("loading"), false);
  assert.equal(shouldConfirmAttachmentPrint("idle"), false);
});

test("blocks print while embedded content is loading", () => {
  assert.equal(getAttachmentPrintDecision("loading"), "wait");
});

test("requires confirmation after an embedded render error", () => {
  assert.equal(getAttachmentPrintDecision("error"), "confirm");
  assert.equal(getAttachmentPrintDecision("ready"), "print");
  assert.equal(getAttachmentPrintDecision("idle"), "print");
});

