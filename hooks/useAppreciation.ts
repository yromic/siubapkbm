import { useState, useCallback } from "react";
import { AppreciationMessage, AppreciationLevel, TriggerAppreciationOptions } from "@/lib/afs/types";
import { AFS_EVENT_REGISTRY } from "@/lib/afs/event-registry";
import { milestoneStorage } from "@/lib/afs/milestone-storage";
import { getAppreciationMessage } from "@/lib/afs/message-library";

export function useAppreciation() {
  const [open, setOpen] = useState(false);
  const [activeLevel, setActiveLevel] = useState<AppreciationLevel>(4);
  const [message, setMessage] = useState<AppreciationMessage>({
    title: "",
    body: "",
  });

  const triggerAppreciation = useCallback(
    (options: TriggerAppreciationOptions): boolean => {
      const { workflowId, role, level, classId, assessmentId, scoreDate, sectionId, revision, academicYearId, semesterId } = options;

      const eventDef = AFS_EVENT_REGISTRY[workflowId];
      const milestoneKey = eventDef
        ? eventDef.buildMilestoneKey({ classId, assessmentId, scoreDate, sectionId, revision, academicYearId, semesterId })
        : `${workflowId}_${classId || "global"}`;

      const alreadyCelebrated = milestoneStorage.isAlreadyCelebrated(milestoneKey);

      if (!alreadyCelebrated) {
        const msg = getAppreciationMessage(workflowId, role);
        setMessage(msg);
        setActiveLevel(level);
        setOpen(true);
        milestoneStorage.recordMilestoneCelebrated(milestoneKey);
        return true;
      }

      return false;
    },
    []
  );

  return {
    open,
    setOpen,
    activeLevel,
    message,
    triggerAppreciation,
  };
}
