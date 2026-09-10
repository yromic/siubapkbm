/**
 * curriculumFilterUtils.ts
 * Centralized filtering and assessment context transformation helpers for SIUBA.
 *
 * Core architectural rule:
 * - SUBJECT PROVENANCE is owned by the TP (e.g. Matematika, Bahasa Indonesia, IPAS)
 * - TRISULA PILLAR is the usage context inside an assessment (LITERASI, NUMERASI, DINIYYAH)
 */

export interface BankTPItem {
  id: string;
  kode?: string | null;
  cp_id?: string | null;
  cp_kode?: string | null;
  cp_teks?: string | null;
  cp_domain_trisula?: string | null;
  teks: string;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  fase: string;
  sumber?: "dari_rpm" | "manual" | "ai_generated";
  created_by?: string;
  creator_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BankCPItem {
  id: string;
  kode?: string | null;
  teks: string;
  fase: string;
  mata_pelajaran_id?: string | null;
  mata_pelajaran_name?: string | null;
  domain_trisula?: string | null;
  sumber?: string;
  status?: string;
  created_by?: string | null;
  creator_name?: string;
  tp_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TrisulaCurriculumItem {
  pillar: "LITERASI" | "NUMERASI" | "DINIYYAH";
  cp_id?: string | null;
  tp_id: string;
  cp_text_snapshot?: string | null;
  tp_text_snapshot: string;
}

export interface SharedBankTPFilterOptions {
  fase?: string;
  subjectName?: string;
  cpId?: string | "ALL";
  searchQuery?: string;
}

export interface TrisulaNativeFilterOptions {
  fase?: string;
  domain?: "Literasi" | "Numerasi" | "Diniyyah";
}

/**
 * Filter for Shared Bank TP.
 * Any subject TP matching the phase, optional subject, CP, and search query is discoverable.
 * NO PILLAR-BASED EXCLUSION is applied here.
 */
export function filterSharedBankTPs(
  tps: BankTPItem[],
  options: SharedBankTPFilterOptions = {}
): BankTPItem[] {
  if (!Array.isArray(tps)) return [];

  const { fase, subjectName, cpId, searchQuery } = options;
  const normalizedSearch = (searchQuery || "").trim().toLowerCase();

  return tps.filter((tp) => {
    // 1. Phase boundary
    if (fase && tp.fase !== fase) {
      return false;
    }

    // 2. Optional subject filter (e.g. "Matematika", "Semua")
    if (subjectName && subjectName !== "Semua") {
      const tpSubject = (tp.mata_pelajaran_name || "").trim().toLowerCase();
      const targetSubject = subjectName.trim().toLowerCase();
      if (tpSubject !== targetSubject) {
        return false;
      }
    }

    // 3. Optional parent CP filter
    if (cpId && cpId !== "ALL") {
      if (tp.cp_id !== cpId) {
        return false;
      }
    }

    // 4. Search query (matches text, subject name, CP code, or CP text)
    if (normalizedSearch) {
      const matchTeks = (tp.teks || "").toLowerCase().includes(normalizedSearch);
      const matchMapel = (tp.mata_pelajaran_name || "").toLowerCase().includes(normalizedSearch);
      const matchCpKode = (tp.cp_kode || "").toLowerCase().includes(normalizedSearch);
      const matchCpTeks = (tp.cp_teks || "").toLowerCase().includes(normalizedSearch);
      if (!matchTeks && !matchMapel && !matchCpKode && !matchCpTeks) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter for Trisula-native CPs.
 * Only returns CPs designated with the specified Trisula domain for the given phase.
 */
export function filterTrisulaNativeCPs(
  cps: BankCPItem[],
  options: TrisulaNativeFilterOptions = {}
): BankCPItem[] {
  if (!Array.isArray(cps)) return [];

  const { fase, domain } = options;

  return cps.filter((cp) => {
    if (fase && cp.fase !== fase) {
      return false;
    }

    if (domain) {
      const matchDomain =
        cp.domain_trisula?.trim().toLowerCase() === domain.toLowerCase() ||
        cp.mata_pelajaran_name?.trim().toLowerCase() === domain.toLowerCase();
      if (!matchDomain) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter for Trisula-native standard TPs.
 * Identifies TPs belonging to the canonical BLC Trisula curriculum by:
 * 1. cp_domain_trisula on parent CP
 * 2. domain_trisula matching mata_pelajaran_name
 * 3. cp_kode containing standard pillar abbreviation (e.g. 'LIT', 'NUM', 'DIN')
 */
export function filterTrisulaNativeTPs(
  tps: BankTPItem[],
  options: TrisulaNativeFilterOptions = {}
): BankTPItem[] {
  if (!Array.isArray(tps)) return [];

  const { fase, domain } = options;
  const domainAbbr = domain ? domain.slice(0, 3).toUpperCase() : "";

  return tps.filter((tp) => {
    if (fase && tp.fase !== fase) {
      return false;
    }

    if (domain) {
      const isParentDomainMatch =
        tp.cp_domain_trisula?.trim().toLowerCase() === domain.toLowerCase();
      const isMapelDomainMatch =
        tp.mata_pelajaran_name?.trim().toLowerCase() === domain.toLowerCase();
      const isCpKodeMatch =
        Boolean(domainAbbr && tp.cp_kode && tp.cp_kode.toUpperCase().includes(domainAbbr));

      if (!isParentDomainMatch && !isMapelDomainMatch && !isCpKodeMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Transforms a selected TP into a Trisula Assessment Curriculum context item.
 * Preserves the TP text and ID without altering the original TP's subject provenance in tp_bank.
 */
export function createAssessmentCurriculumItem(params: {
  pillar: "LITERASI" | "NUMERASI" | "DINIYYAH";
  selectedTP: {
    tpId?: string;
    teks: string;
    cpId?: string | null;
    cpTeks?: string | null;
    fase: string;
    mataPelajaran?: string | null;
  };
}): TrisulaCurriculumItem {
  return {
    pillar: params.pillar,
    cp_id: params.selectedTP.cpId || null,
    tp_id: params.selectedTP.tpId || "custom",
    cp_text_snapshot: params.selectedTP.cpTeks || null,
    tp_text_snapshot: params.selectedTP.teks,
  };
}
