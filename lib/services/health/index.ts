import {
  checkDatabaseConnectivity,
  checkDatabaseAccessibility,
  checkStorage,
  checkRuntime,
} from "./infrastructure";
import {
  checkActiveAcademicYear,
  checkActiveSemester,
  checkSchoolProfile,
  checkBrandingConfiguration,
  checkStorageConfiguration,
  checkAuditConfiguration,
  checkEnvironmentConfiguration,
} from "./configuration";
import {
  checkAuditLoggingService,
  checkJobQueueService,
  checkBackgroundWorkerService,
  checkBackupService,
  checkCacheService,
  checkDiagnosticsService,
  checkMonitoringServices,
} from "./operations";
import {
  checkActiveAcademicYearIntegrity,
  checkActiveSemesterIntegrity,
  checkStudentEnrollmentIntegrity,
  checkAssessmentIntegrity,
  checkAssessmentScoreIntegrity,
  checkAttendanceIntegrity,
  checkFinanceIntegrity,
  checkAuditLogIntegrity,
  checkDashboardDependencyIntegrity,
} from "./integrity";
import { aggregateHealthResults } from "./aggregation";
import { HealthResponse, HealthSection } from "./types";
import { HEALTH_CODES } from "./codes";

export * from "./types";
export * from "./codes";
export * from "./issueRegistry";
export * from "./infrastructure";
export * from "./configuration";
export * from "./operations";
export * from "./integrity";
export * from "./aggregation";

export async function getHealthV2(): Promise<HealthResponse> {
  const checkers = [
    // Infrastructure Checkers (Sprint 1)
    checkDatabaseConnectivity,
    checkDatabaseAccessibility,
    checkStorage,
    checkRuntime,

    // Configuration Checkers (Sprint 2)
    checkActiveAcademicYear,
    checkActiveSemester,
    checkSchoolProfile,
    checkBrandingConfiguration,
    checkStorageConfiguration,
    checkAuditConfiguration,
    checkEnvironmentConfiguration,

    // Operational Services Checkers (Sprint 3)
    checkAuditLoggingService,
    checkJobQueueService,
    checkBackgroundWorkerService,
    checkBackupService,
    checkCacheService,
    checkDiagnosticsService,
    checkMonitoringServices,

    // Business Data Integrity Checkers (Sprint 4)
    checkActiveAcademicYearIntegrity,
    checkActiveSemesterIntegrity,
    checkStudentEnrollmentIntegrity,
    checkAssessmentIntegrity,
    checkAssessmentScoreIntegrity,
    checkAttendanceIntegrity,
    checkFinanceIntegrity,
    checkAuditLogIntegrity,
    checkDashboardDependencyIntegrity,
  ];

  const sections: HealthSection[] = await Promise.all(
    checkers.map(async (checker) => {
      try {
        return await checker();
      } catch (error) {
        return {
          id: checker.name || "unknown_checker",
          title: "Pemeriksaan Sistem",
          category: "operations",
          status: "unknown",
          duration_ms: 0,
          checked_at: new Date().toISOString(),
          issues: [
            {
              code: HEALTH_CODES.CHECKER_EXECUTION_FAILED,
              severity: "unknown",
              message: "Gagal mengeksekusi pemeriksaan sistem.",
              technical_details: {
                error: error instanceof Error ? error.message : String(error),
              },
            },
          ],
          details: {},
        };
      }
    })
  );

  return aggregateHealthResults(sections);
}

// Backward compatibility alias for Sprint 1
export const getInfrastructureHealthV2 = getHealthV2;
