// OBSOLETE FILE DEPRECATION - REDIRECT TO MILESTONE STORAGE
import { milestoneStorage } from "./milestone-storage";

export const cooldownManager = {
  isEligible(workflowId: string, classId?: string): boolean {
    return !milestoneStorage.isAlreadyCelebrated(`${workflowId}_${classId || "global"}`);
  },
  recordTrigger(workflowId: string, classId?: string): void {
    milestoneStorage.recordMilestoneCelebrated(`${workflowId}_${classId || "global"}`);
  },
};
