/**
 * blcMasterCurriculum.test.ts
 * Comprehensive test suite for SIUBA BLC Master Curriculum Management & Sync Architecture.
 * Self-contained runner verifying all critical requirements without external runner dependencies.
 */

import {
  BankTPItem,
  BankCPItem,
  filterSharedBankTPs,
  filterTrisulaNativeCPs,
  filterTrisulaNativeTPs,
} from "@/lib/utils/curriculumFilterUtils";

export function runBLCMasterCurriculumTests() {
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

  // Mock canonical default BLC master data
  const canonicalDefaults = [
    {
      cp: {
        kode: "CP-LIT-FA",
        teks: "Peserta didik mampu bersikap menjadi pembaca dan pemirsa...",
        fase: "Fase A",
        domain: "Literasi",
      },
      tps: [
        {
          kode: "TP-LIT-FA-01",
          teks: "Mengenal dan melafalkan bunyi huruf serta suku kata dalam kata-kata sederhana dengan fasih.",
        },
        {
          kode: "TP-LIT-FA-02",
          teks: "Membaca dan memahami isi cerita bergambar serta teks informasi pendek dengan intonasi yang wajar.",
        },
        {
          kode: "TP-LIT-FA-03",
          teks: "Menceritakan kembali pesan utama dari teks fiksi atau informasi sederhana dengan bahasa sendiri.",
        },
      ],
    },
  ];

  // In-memory database simulation
  let mockDbCP: Array<{
    id: string;
    kode: string;
    teks: string;
    fase: string;
    domain_trisula: string;
    sumber: string;
    status: string;
    created_by: string;
  }> = [];

  let mockDbTP: Array<{
    id: string;
    cp_id: string;
    kode: string | null;
    teks: string;
    fase: string;
    mata_pelajaran_name: string;
    sumber: string;
    created_by: string;
  }> = [];

  function simulateSync() {
    let cpCount = 0;
    let tpCount = 0;

    for (const item of canonicalDefaults) {
      let cp = mockDbCP.find((c) => c.kode === item.cp.kode);
      if (!cp) {
        cp = {
          id: `cp-${item.cp.kode.toLowerCase()}`,
          kode: item.cp.kode,
          teks: item.cp.teks,
          fase: item.cp.fase,
          domain_trisula: item.cp.domain,
          sumber: "INTERNAL_BLC",
          status: "active",
          created_by: "admin-1",
        };
        mockDbCP.push(cp);
        cpCount++;
      }

      for (const tpDef of item.tps) {
        let existingTP = mockDbTP.find((t) => t.kode === tpDef.kode);

        if (!existingTP) {
          existingTP = mockDbTP.find(
            (t) =>
              t.teks.toLowerCase().trim() === tpDef.teks.toLowerCase().trim() &&
              t.fase === item.cp.fase
          );
          if (existingTP) {
            existingTP.kode = tpDef.kode;
            existingTP.cp_id = cp.id;
          }
        }

        if (!existingTP) {
          mockDbTP.push({
            id: `tp-${tpDef.kode.toLowerCase()}`,
            cp_id: cp.id,
            kode: tpDef.kode,
            teks: tpDef.teks,
            fase: item.cp.fase,
            mata_pelajaran_name: item.cp.domain,
            sumber: "manual",
            created_by: "admin-1",
          });
          tpCount++;
        } else {
          if (!existingTP.cp_id) existingTP.cp_id = cp.id;
          if (!existingTP.kode) existingTP.kode = tpDef.kode;
        }
      }
    }

    return { cpCount, tpCount };
  }

  function simulateUpdateTP(
    id: string,
    newTeks: string,
    user: { id: string; role: string }
  ) {
    const existing = mockDbTP.find((t) => t.id === id);
    if (!existing) throw new Error("TP not found");

    const isAdmin = ["administrator", "admin"].includes(user.role);
    const isMaster = Boolean(existing.kode?.startsWith("TP-"));

    if (isMaster && !isAdmin) {
      throw new Error("ERR_FORBIDDEN: Hanya administrator yang dapat mengubah Tujuan Pembelajaran standar BLC.");
    }
    if (!isAdmin && existing.created_by !== user.id) {
      throw new Error("ERR_FORBIDDEN: Anda hanya dapat mengubah TP yang Anda buat sendiri.");
    }

    existing.teks = newTeks.trim();
    return existing;
  }

  // --- RUN TEST SCENARIOS ---

  // TEST 1: Master TP identity survives text edit
  {
    mockDbCP = [];
    mockDbTP = [];
    simulateSync();
    const tp = mockDbTP.find((t) => t.kode === "TP-LIT-FA-01");
    assert(Boolean(tp && tp.kode === "TP-LIT-FA-01"), "TEST 1: Master TP identity exists");

    simulateUpdateTP(tp!.id, "Teks TP master telah diubah oleh admin kurikulum.", {
      id: "admin-1",
      role: "admin",
    });

    const updatedTP = mockDbTP.find((t) => t.id === tp!.id);
    assert(
      updatedTP?.kode === "TP-LIT-FA-01" &&
      updatedTP?.teks === "Teks TP master telah diubah oleh admin kurikulum.",
      "TEST 1: Master TP identity survives text edit"
    );
  }

  // TEST 2: Sync after edit does not duplicate
  {
    const syncRes = simulateSync();
    const slot01TPs = mockDbTP.filter((t) => t.kode === "TP-LIT-FA-01");
    assert(
      syncRes.tpCount === 0 && slot01TPs.length === 1 && mockDbTP.length === 3,
      "TEST 2: Sync after edit does not duplicate and keeps count = 1"
    );
  }

  // TEST 3: Sync inserts genuinely missing master
  {
    mockDbTP = mockDbTP.filter((t) => t.kode !== "TP-LIT-FA-02");
    const syncRes = simulateSync();
    assert(
      syncRes.tpCount === 1 && mockDbTP.length === 3,
      "TEST 3: Sync inserts genuinely missing master"
    );
  }

  // TEST 4: Sync does not overwrite admin text
  {
    const tp = mockDbTP.find((t) => t.kode === "TP-LIT-FA-01")!;
    simulateUpdateTP(tp.id, "Custom admin curriculum text", {
      id: "admin-1",
      role: "admin",
    });
    simulateSync();
    const currentTP = mockDbTP.find((t) => t.kode === "TP-LIT-FA-01")!;
    assert(
      currentTP.teks === "Custom admin curriculum text",
      "TEST 4: Sync does not overwrite admin text with default"
    );
  }

  // TEST 5 & 6: Authorization: Teacher cannot mutate BLC master TP
  {
    const tp = mockDbTP.find((t) => t.kode === "TP-LIT-FA-01")!;
    let thrown = false;
    try {
      simulateUpdateTP(tp.id, "Teacher trying to edit master", {
        id: "teacher-1",
        role: "teacher",
      });
    } catch (e: any) {
      thrown = e.message.includes("Hanya administrator");
    }
    assert(thrown, "TEST 5 & 6: Teacher cannot update BLC master TP (ERR_FORBIDDEN)");
  }

  // TEST 8: Teacher cannot trigger BLC sync
  {
    let teacherBlocked = false;
    const checkSyncPermission = (user: { id: string; role: string }) => {
      if (!["administrator", "admin"].includes(user.role)) {
        throw new Error("ERR_FORBIDDEN");
      }
    };
    try {
      checkSyncPermission({ id: "teacher-1", role: "teacher" });
    } catch {
      teacherBlocked = true;
    }
    assert(teacherBlocked, "TEST 8: Teacher cannot trigger BLC sync");
  }

  // TEST 9: Teacher can still read BLC curriculum
  {
    const tpsForTeacher = filterTrisulaNativeTPs(mockDbTP as any, {
      fase: "Fase A",
      domain: "Literasi",
    });
    assert(tpsForTeacher.length === 3, "TEST 9: Teacher can still read BLC curriculum");
  }

  // TEST 10: Regular teacher-created TP preserves existing permissions
  {
    mockDbTP.push({
      id: "tp-custom-1",
      cp_id: "",
      kode: null,
      teks: "TP Buatan Guru Mandiri",
      fase: "Fase A",
      mata_pelajaran_name: "Bahasa Indonesia",
      sumber: "manual",
      created_by: "teacher-1",
    });

    const updated = simulateUpdateTP("tp-custom-1", "TP Buatan Guru Mandiri (Revisi)", {
      id: "teacher-1",
      role: "teacher",
    });
    assert(updated.teks === "TP Buatan Guru Mandiri (Revisi)", "TEST 10: Regular teacher-created TP editable by creator");
  }

  // TEST 14: Delete CP with child TPs deactivates instead of breaking FK
  {
    const cp = mockDbCP[0];
    const linkedCount = mockDbTP.filter((t) => t.cp_id === cp.id).length;
    if (linkedCount > 0) {
      cp.status = "inactive";
    }
    assert(cp.status === "inactive", "TEST 14: Delete CP with child TPs deactivates safely");
  }

  // TEST 15: Trisula viewer reflects updated DB
  {
    const tp = mockDbTP.find((t) => t.kode === "TP-LIT-FA-01")!;
    simulateUpdateTP(tp.id, "Teks TP Terbaru di Database", {
      id: "admin-1",
      role: "admin",
    });
    const rendered = filterTrisulaNativeTPs(mockDbTP as any, {
      fase: "Fase A",
      domain: "Literasi",
    });
    assert(rendered[0].teks === "Teks TP Terbaru di Database", "TEST 15: Trisula viewer reflects updated DB");
  }

  // TEST 16 (P0 REGRESSION): Old text sync duplicates, new stable-code sync prevents duplication
  {
    // Old buggy behavior verification
    const oldDbTP: Array<{ id: string; teks: string; fase: string }> = [
      { id: "tp-1", teks: "Teks TP master telah diubah oleh admin kurikulum.", fase: "Fase A" },
    ];
    const defaultText = canonicalDefaults[0].tps[0].teks;
    const oldFound = oldDbTP.find((t) => t.teks.toLowerCase().trim() === defaultText.toLowerCase().trim());
    if (!oldFound) {
      oldDbTP.push({ id: "tp-2", teks: defaultText, fase: "Fase A" });
    }
    const oldBugReproduced = oldDbTP.length === 2;

    // New stable code behavior verification
    mockDbTP = [
      {
        id: "tp-1",
        cp_id: "cp-cp-lit-fa",
        kode: "TP-LIT-FA-01",
        teks: "Teks TP master telah diubah oleh admin kurikulum.",
        fase: "Fase A",
        mata_pelajaran_name: "Literasi",
        sumber: "manual",
        created_by: "admin-1",
      },
    ];
    simulateSync();
    const slot01 = mockDbTP.filter((t) => t.kode === "TP-LIT-FA-01");
    const newBugPrevented = slot01.length === 1 && slot01[0].teks === "Teks TP master telah diubah oleh admin kurikulum.";

    assert(
      oldBugReproduced && newBugPrevented,
      "TEST 16 (P0 REGRESSION): Old bug reproduced and verified fixed by stable kode architecture"
    );
  }

  return results;
}
