import assert from "node:assert/strict";
import test from "node:test";

import { resolveBuildInfo } from "./buildInfo.ts";

test("prefers the deployment commit SHA without hardcoding a build", () => {
  assert.deepEqual(resolveBuildInfo({ VERCEL_GIT_COMMIT_SHA: "abcdef1234567890" }), {
    sha: "abcdef1234567890",
    source: "VERCEL_GIT_COMMIT_SHA",
  });
});

test("uses supported SHA variables in deterministic priority order", () => {
  assert.deepEqual(resolveBuildInfo({ GIT_COMMIT_SHA: "git-commit", NEXT_PUBLIC_GIT_SHA: "public-commit" }), {
    sha: "git-commit",
    source: "GIT_COMMIT_SHA",
  });
});

test("reports an unverifiable runtime instead of inventing a SHA", () => {
  assert.deepEqual(resolveBuildInfo({}), { sha: null, source: "UNVERIFIED" });
});
