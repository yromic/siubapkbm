import test from "node:test";
import assert from "node:assert/strict";
import {
  LETTERHEAD_MARGIN_MODE_ABSOLUTE,
  getLetterheadMargins,
  normalizeLetterheadMargin,
  validateLetterheadMarginSettings,
} from "./letterheadMarginUtils.ts";

test("legacy letterhead margins remain additional to the historic page inset", () => {
  assert.deepEqual(getLetterheadMargins(), { top: 10, right: 12, bottom: 0, left: 12 });
  assert.deepEqual(
    getLetterheadMargins({
      letterhead_margin_top_mm: "5",
      letterhead_margin_right_mm: "7.5",
      letterhead_margin_bottom_mm: "3",
      letterhead_margin_left_mm: "7.5",
    }),
    { top: 15, right: 19.5, bottom: 3, left: 19.5 },
  );
});

test("absolute margins are measured from the paper edge", () => {
  assert.deepEqual(
    getLetterheadMargins({
      letterhead_margin_mode: LETTERHEAD_MARGIN_MODE_ABSOLUTE,
      letterhead_margin_top_mm: "5",
      letterhead_margin_right_mm: "8",
      letterhead_margin_bottom_mm: "2",
      letterhead_margin_left_mm: "7",
    }),
    { top: 5, right: 8, bottom: 2, left: 7 },
  );
});

test("letterhead margins are constrained to the safe range", () => {
  assert.equal(normalizeLetterheadMargin(-2), 0);
  assert.equal(normalizeLetterheadMargin(50), 30);
  assert.equal(normalizeLetterheadMargin("invalid"), 0);
  assert.throws(
    () => validateLetterheadMarginSettings({ letterhead_margin_left_mm: "31" }),
    /antara 0 dan 30 mm/,
  );
  assert.doesNotThrow(() => validateLetterheadMarginSettings({
    letterhead_margin_mode: LETTERHEAD_MARGIN_MODE_ABSOLUTE,
    letterhead_margin_top_mm: "0",
    letterhead_margin_right_mm: "0",
    letterhead_margin_left_mm: "0",
  }));
});
