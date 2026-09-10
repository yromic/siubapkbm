/**
 * curriculumFilterUtils.test.ts
 * Rigorous test suite validating all 7 TDD regression criteria from Prompt Section 22.
 */

import {
  filterSharedBankTPs,
  filterTrisulaNativeCPs,
  filterTrisulaNativeTPs,
  createAssessmentCurriculumItem,
  BankTPItem,
  BankCPItem,
} from "../curriculumFilterUtils";

export function runCurriculumFilterTests() {
  const results: Array<{ name: string; passed: boolean; message?: string }> = [];

  function assert(condition: boolean, name: string, message?: string) {
    if (!condition) {
      results.push({ name, passed: false, message: message || "Assertion failed" });
      console.error(`❌ FAIL: ${name} - ${message || ""}`);
    } else {
      results.push({ name, passed: true });
      console.log(`✅ PASS: ${name}`);
    }
  }

  // --- MOCK TEST FIXTURES ---
  const regularMatematikaTP: BankTPItem = {
    id: "tp-mat-001",
    teks: "Menyajikan dan menginterpretasikan data dalam bentuk diagram batang sederhana.",
    mata_pelajaran_name: "Matematika",
    mata_pelajaran_id: "subj-mat-01",
    fase: "Fase B",
    cp_id: null,
    sumber: "dari_rpm",
    created_by: "guru-01",
  };

  const regularIpasTP: BankTPItem = {
    id: "tp-ipas-002",
    teks: "Membaca dan menjelaskan perubahan suhu melalui grafik pengamatan.",
    mata_pelajaran_name: "IPAS",
    mata_pelajaran_id: "subj-ipas-01",
    fase: "Fase B",
    cp_id: null,
    sumber: "manual",
    created_by: "guru-02",
  };

  const nativeNumerasiCP: BankCPItem = {
    id: "cp-num-fb",
    kode: "CP-NUM-FB",
    teks: "Peserta didik mampu memahami operasi perkalian, pembagian, dan penalaran data...",
    domain_trisula: "Numerasi",
    mata_pelajaran_name: "Numerasi",
    fase: "Fase B",
    sumber: "INTERNAL_BLC",
    status: "active",
  };

  const nativeLiterasiCP: BankCPItem = {
    id: "cp-lit-fb",
    kode: "CP-LIT-FB",
    teks: "Peserta didik mampu memahami pesan dan informasi tentang topik kontekstual...",
    domain_trisula: "Literasi",
    mata_pelajaran_name: "Literasi",
    fase: "Fase B",
    sumber: "INTERNAL_BLC",
    status: "active",
  };

  const nativeNumerasiTP: BankTPItem = {
    id: "tp-num-native-01",
    cp_id: "cp-num-fb",
    cp_kode: "CP-NUM-FB",
    cp_domain_trisula: "Numerasi",
    teks: "Menyelesaikan operasi hitung perkalian dan pembagian bilangan cacah sampai 1.000.",
    mata_pelajaran_name: "Numerasi",
    fase: "Fase B",
    sumber: "manual",
  };

  const nativeLiterasiTP: BankTPItem = {
    id: "tp-lit-native-01",
    cp_id: "cp-lit-fb",
    cp_kode: "CP-LIT-FB",
    cp_domain_trisula: "Literasi",
    teks: "Menemukan ide pokok dan informasi tersurat maupun tersirat dalam teks bacaan.",
    mata_pelajaran_name: "Literasi",
    fase: "Fase B",
    sumber: "manual",
  };

  const allTPs: BankTPItem[] = [
    regularMatematikaTP,
    regularIpasTP,
    nativeNumerasiTP,
    nativeLiterasiTP,
  ];

  const allCPs: BankCPItem[] = [nativeNumerasiCP, nativeLiterasiCP];

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1 — Regular TP visible in Trisula Shared Bank
  // ──────────────────────────────────────────────────────────────────────────
  const sharedBankItems = filterSharedBankTPs(allTPs, { fase: "Fase B" });
  const foundMatematika = sharedBankItems.find((t) => t.id === "tp-mat-001");
  assert(
    Boolean(foundMatematika),
    "TEST 1: Regular TP (Matematika, cp_id=null) visible in Shared Bank on Fase B",
    "Matematika TP must be discoverable regardless of any Trisula pillar context."
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2 — Selection preserves provenance
  // ──────────────────────────────────────────────────────────────────────────
  const selectedContext = createAssessmentCurriculumItem({
    pillar: "NUMERASI",
    selectedTP: {
      tpId: regularMatematikaTP.id,
      teks: regularMatematikaTP.teks,
      cpId: regularMatematikaTP.cp_id,
      fase: regularMatematikaTP.fase,
      mataPelajaran: regularMatematikaTP.mata_pelajaran_name,
    },
  });

  assert(
    selectedContext.pillar === "NUMERASI" &&
      selectedContext.tp_id === "tp-mat-001" &&
      selectedContext.tp_text_snapshot === regularMatematikaTP.teks &&
      regularMatematikaTP.mata_pelajaran_name === "Matematika",
    "TEST 2: Selection assigns pillar to assessment context while preserving TP Bank subject",
    `Assessment pillar was ${selectedContext.pillar}, but TP subject is still ${regularMatematikaTP.mata_pelajaran_name}.`
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3 — Same TP reusable for another pillar context
  // ──────────────────────────────────────────────────────────────────────────
  const ipasInLiterasi = createAssessmentCurriculumItem({
    pillar: "LITERASI",
    selectedTP: {
      tpId: regularIpasTP.id,
      teks: regularIpasTP.teks,
      cpId: regularIpasTP.cp_id,
      fase: regularIpasTP.fase,
      mataPelajaran: regularIpasTP.mata_pelajaran_name,
    },
  });

  const ipasInNumerasi = createAssessmentCurriculumItem({
    pillar: "NUMERASI",
    selectedTP: {
      tpId: regularIpasTP.id,
      teks: regularIpasTP.teks,
      cpId: regularIpasTP.cp_id,
      fase: regularIpasTP.fase,
      mataPelajaran: regularIpasTP.mata_pelajaran_name,
    },
  });

  assert(
    ipasInLiterasi.pillar === "LITERASI" &&
      ipasInNumerasi.pillar === "NUMERASI" &&
      ipasInLiterasi.tp_id === ipasInNumerasi.tp_id &&
      regularIpasTP.mata_pelajaran_name === "IPAS",
    "TEST 3: Same TP is reusable across multiple assessment pillar contexts without mutation",
    "TP IPAS must be attachable to both LITERASI and NUMERASI without changing tp_bank."
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4 — Trisula-native filtering via CP domain
  // ──────────────────────────────────────────────────────────────────────────
  const nativeNumerasiCPs = filterTrisulaNativeCPs(allCPs, {
    fase: "Fase B",
    domain: "Numerasi",
  });
  const nativeNumerasiTPs = filterTrisulaNativeTPs(allTPs, {
    fase: "Fase B",
    domain: "Numerasi",
  });

  assert(
    nativeNumerasiCPs.length === 1 &&
      nativeNumerasiCPs[0].id === "cp-num-fb" &&
      nativeNumerasiTPs.length === 1 &&
      nativeNumerasiTPs[0].id === "tp-num-native-01",
    "TEST 4: Native Trisula filtering returns only designated domain CPs and TPs",
    "Trisula native filtering must respect domain_trisula correctly."
  );

  const nativeLiterasiCheck = filterTrisulaNativeTPs(allTPs, {
    fase: "Fase B",
    domain: "Literasi",
  });
  assert(
    nativeLiterasiCheck.length === 1 &&
      nativeLiterasiCheck[0].id === "tp-lit-native-01" &&
      !nativeLiterasiCheck.some((t) => t.id === "tp-num-native-01"),
    "TEST 4b: Native Numerasi TP does not leak into Native Literasi tab",
    "Pillar isolation on native BLC curriculum tabs must be strictly enforced."
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5 — Phase boundary enforcement
  // ──────────────────────────────────────────────────────────────────────────
  const faseATPs = filterSharedBankTPs(allTPs, { fase: "Fase A" });
  assert(
    faseATPs.length === 0,
    "TEST 5: Phase boundary: Fase B TPs are not visible in Fase A filter",
    "A Fase B TP must never leak into a Fase A classroom query."
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6 — Optional Subject Filter in Shared Bank
  // ──────────────────────────────────────────────────────────────────────────
  const mathOnly = filterSharedBankTPs(allTPs, {
    fase: "Fase B",
    subjectName: "Matematika",
  });
  assert(
    mathOnly.length === 1 && mathOnly[0].id === "tp-mat-001",
    "TEST 6: Subject convenience filter in Shared Bank isolates chosen subject correctly"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7 — Search Query across multiple fields
  // ──────────────────────────────────────────────────────────────────────────
  const searchResult = filterSharedBankTPs(allTPs, {
    fase: "Fase B",
    searchQuery: "diagram batang",
  });
  assert(
    searchResult.length === 1 && searchResult[0].id === "tp-mat-001",
    "TEST 7: Search query matches TP content inside Shared Bank"
  );

  const allPassed = results.every((r) => r.passed);
  return { allPassed, results };
}

// Execute immediately if run in node/ts-node
if (typeof require !== "undefined" && require.main === module) {
  const { allPassed, results } = runCurriculumFilterTests();
  console.log(`\nTest Summary: ${results.filter((r) => r.passed).length}/${results.length} Passed`);
  if (!allPassed) {
    process.exit(1);
  }
}
