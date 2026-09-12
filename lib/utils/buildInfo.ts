export interface BuildInfo {
  sha: string | null;
  source: "VERCEL_GIT_COMMIT_SHA" | "GIT_COMMIT_SHA" | "NEXT_PUBLIC_GIT_SHA" | "UNVERIFIED";
}

type BuildEnvironment = Partial<Record<
  "VERCEL_GIT_COMMIT_SHA" | "GIT_COMMIT_SHA" | "NEXT_PUBLIC_GIT_SHA",
  string | undefined
>>;

export function resolveBuildInfo(environment: BuildEnvironment): BuildInfo {
  const candidates = [
    ["VERCEL_GIT_COMMIT_SHA", environment.VERCEL_GIT_COMMIT_SHA],
    ["GIT_COMMIT_SHA", environment.GIT_COMMIT_SHA],
    ["NEXT_PUBLIC_GIT_SHA", environment.NEXT_PUBLIC_GIT_SHA],
  ] as const;

  for (const [source, value] of candidates) {
    const sha = value?.trim();
    if (sha) return { sha, source };
  }

  return { sha: null, source: "UNVERIFIED" };
}
