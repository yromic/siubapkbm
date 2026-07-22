import { RoleType, AppreciationLevel } from "./types";

export interface AFSEventDefinition {
  eventId: string;
  workflowId: string;
  level: AppreciationLevel;
  role: RoleType;
  buildMilestoneKey: (params: Record<string, string | undefined>) => string;
}

export const AFS_EVENT_REGISTRY: Record<string, AFSEventDefinition> = {
  academic_100: {
    eventId: "academic_100_completed",
    workflowId: "academic_100",
    level: 4,
    role: "teacher",
    buildMilestoneKey: ({ classId, assessmentId }) =>
      `academic_100_${classId || "global"}_${assessmentId || "default"}`,
  },
  culture_100: {
    eventId: "culture_100_completed",
    workflowId: "culture_100",
    level: 4,
    role: "teacher",
    buildMilestoneKey: ({ classId, scoreDate }) =>
      `culture_100_${classId || "global"}_${scoreDate || "today"}`,
  },
  cms_publish: {
    eventId: "cms_section_published",
    workflowId: "cms_publish",
    level: 4,
    role: "admin",
    buildMilestoneKey: ({ sectionId, revision }) =>
      `cms_publish_${sectionId || "homepage"}_${revision || Date.now()}`,
  },
  class_promotion: {
    eventId: "class_promotion_completed",
    workflowId: "class_promotion",
    level: 5,
    role: "admin",
    buildMilestoneKey: ({ academicYearId, classId }) =>
      `promotion_${academicYearId || "year"}_${classId || "all"}`,
  },
  semester_finalize: {
    eventId: "semester_finalized",
    workflowId: "semester_finalize",
    level: 5,
    role: "admin",
    buildMilestoneKey: ({ academicYearId, semesterId }) =>
      `semester_finalize_${academicYearId || "year"}_${semesterId || "sem"}`,
  },
};
