"use client";

import React, { useState } from "react";

export interface OfficialSchoolLetterheadProps {
  /** Optional custom image source. Defaults to /branding/school-letterhead.png */
  src?: string;
  /** App settings fallback for school name and address */
  schoolSettings?: {
    school_name?: string;
    school_sub_header?: string;
  };
  defaultSchoolName?: string;
  defaultSubHeader?: string;
  className?: string;
}

const DEFAULT_SCHOOL_NAME = "PKBM BAITUSYUKUR LEARNING CENTER (BLC)";
const DEFAULT_SUB_HEADER =
  "Pendidikan Kesetaraan Paket A / B / C • Kurikulum Merdeka Terintegrasi BLC\nPusat Kegiatan Belajar Mengajar & Pengembangan Karakter Generasi Qurani";

/**
 * OfficialSchoolLetterhead
 *
 * Renders the official school letterhead image with preserved aspect ratio.
 * If the image fails to load or is not present, gracefully falls back to
 * a clean, authoritative textual header sourced from app settings.
 */
export function OfficialSchoolLetterhead({
  src = "/branding/school-letterhead.png",
  schoolSettings,
  defaultSchoolName = DEFAULT_SCHOOL_NAME,
  defaultSubHeader = DEFAULT_SUB_HEADER,
  className = "",
}: OfficialSchoolLetterheadProps) {
  const [imgError, setImgError] = useState(false);

  const resolvedSchoolName =
    schoolSettings?.school_name?.trim() || defaultSchoolName;
  const resolvedSubHeader =
    schoolSettings?.school_sub_header?.trim() || defaultSubHeader;

  return (
    <div className={`official-school-letterhead w-full ${className}`}>
      {!imgError ? (
        <div className="w-full overflow-hidden flex justify-center items-center pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Kop Resmi Sekolah PKBM Baitusyukur Learning Center"
            className="w-full h-auto max-h-[140px] object-contain block mx-auto print:w-full print:h-auto print:max-h-[140px]"
            style={{
              printColorAdjust: "exact",
              WebkitPrintColorAdjust: "exact",
            }}
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="border-b-2 border-black pb-3 text-center print:border-black">
          <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-black leading-snug">
            {resolvedSchoolName}
          </h1>
          <p className="text-xs font-semibold text-gray-800 mt-0.5 whitespace-pre-line leading-relaxed">
            {resolvedSubHeader}
          </p>
        </div>
      )}
    </div>
  );
}
