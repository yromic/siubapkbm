export type RoleType = "teacher" | "admin" | "parent";
export type AppreciationLevel = 4 | 5;

export interface AppreciationMessage {
  title: string;
  body: string;
}

export interface TriggerAppreciationOptions {
  workflowId: string;
  role: RoleType;
  level: AppreciationLevel;
  classId?: string;
  assessmentId?: string;
  scoreDate?: string;
  sectionId?: string;
  revision?: string;
  academicYearId?: string;
  semesterId?: string;
}
