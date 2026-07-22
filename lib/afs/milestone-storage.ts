const MILESTONE_PREFIX = "siuba_afs_milestone_";
const OBSOLETE_COOLDOWN_PREFIX = "siuba_afs_cd_";

export const milestoneStorage = {
  isAlreadyCelebrated(milestoneKey: string): boolean {
    if (typeof window === "undefined") return false;
    try {
      this.migrateLegacyKeys();
      const key = `${MILESTONE_PREFIX}${milestoneKey}`;
      const record = localStorage.getItem(key);
      return !!record;
    } catch (e) {
      return false;
    }
  },

  recordMilestoneCelebrated(milestoneKey: string): void {
    if (typeof window === "undefined") return;
    try {
      const key = `${MILESTONE_PREFIX}${milestoneKey}`;
      localStorage.setItem(key, new Date().toISOString());
    } catch (e) {
      // Ignore storage write errors
    }
  },

  migrateLegacyKeys(): void {
    if (typeof window === "undefined") return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(OBSOLETE_COOLDOWN_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      // Ignore migration errors
    }
  },
};
