"use client";

import React from "react";
import { AcademicSummarySection } from "./AcademicSummarySection";
import type { RaportAcademicSummaryReport } from "@/lib/services/raportTerpaduService";
import {
  type RaportSectionConfig,
  DEFAULT_RAPORT_SECTIONS,
} from "@/lib/utils/raportCalculationUtils";

export interface RaportTerpaduDocumentProps {
  report: RaportAcademicSummaryReport;
  sections?: RaportSectionConfig;
  className?: string;
}

/**
 * Modular Raport Terpadu Document Renderer.
 * Supports variable-length sections without hardcoded page assumptions:
 * - Lembar 1: Academic Summary (Mandatory)
 * - [Future]: KKTP Detail Section
 * - [Future]: Trisula 3 Pilar Section
 * - [Future]: Attendance / Presensi Section
 * - [Future]: SAHABAT & UTSMAN Section
 * - [Future]: Fitrah Belajar & Bakat Section
 */
export function RaportTerpaduDocument({
  report,
  sections = DEFAULT_RAPORT_SECTIONS,
  className = "",
}: RaportTerpaduDocumentProps) {
  return (
    <div className={`raport-terpadu-document space-y-8 print:space-y-0 ${className}`}>
      {/* ─── LEMBAR 1: HASIL RATA-RATA CAPAIAN SETIAP MATA PELAJARAN (AKADEMIK) ─── */}
      {sections.academic && (
        <AcademicSummarySection
          data={report}
          isPrintBreak={Boolean(
            sections.kktp ||
              sections.trisula ||
              sections.attendance ||
              sections.sahabatUtsman ||
              sections.fitrah
          )}
        />
      )}

      {/* Future sections slots - can be dynamically composed here */}
      {sections.kktp && (
        <div className="print-page-break print:p-0">
          {/* Future KKTP Detail Section will be rendered here */}
        </div>
      )}

      {sections.trisula && (
        <div className="print-page-break print:p-0">
          {/* Future Trisula Section will be rendered here */}
        </div>
      )}

      {sections.attendance && (
        <div className="print-page-break print:p-0">
          {/* Future Attendance Section will be rendered here */}
        </div>
      )}

      {sections.sahabatUtsman && (
        <div className="print-page-break print:p-0">
          {/* Future Sahabat/Utsman Section will be rendered here */}
        </div>
      )}

      {sections.fitrah && (
        <div className="print-page-break print:p-0">
          {/* Future Fitrah Section will be rendered here */}
        </div>
      )}
    </div>
  );
}
