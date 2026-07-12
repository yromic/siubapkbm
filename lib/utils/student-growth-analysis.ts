import { IndividualCharacterSummary } from "@/lib/api/character";

export interface StudentGrowthPeriod {
  month: number;
  year: number;
  data: IndividualCharacterSummary;
}

export interface GrowthAnalysisResult {
  hasHistory: boolean;
  hasEnoughData: boolean;
  validPeriodsCount: number;
  
  // Growth Status Card
  latestOverall: number | null;
  earliestOverall: number | null;
  delta: number | null;
  status: "Meningkat" | "Stabil" | "Perlu Perhatian" | "Data Belum Cukup";
  
  // Strongest and Area Penguatan
  strongestDimension: { key: string; name: string; score: number } | null;
  weakestDimension: { key: string; name: string; score: number } | null; // Area Penguatan
  
  // Data Completeness Warning
  latestDaysCounted: number;
  isLowCompleteness: boolean;
  
  // Human-Readable Summary
  growthSummaryText: string | null;
}

const FITRAH_DIMENSIONS_CONFIG = [
  { key: "f", name: "Fathonah" },
  { key: "i", name: "Istiqamah" },
  { key: "t", name: "Tanggung Jawab" },
  { key: "r", name: "Ramah" },
  { key: "a", name: "Amanah" },
  { key: "h", name: "Harmonis" },
] as const;

export function analyzeStudentGrowth(
  historicalData: { month: number; year: number; data: IndividualCharacterSummary }[]
): GrowthAnalysisResult {
  // Sort chronologically (earliest to latest)
  const chronologicalData = [...historicalData]
    .reverse()
    .map((item) => {
      const f = item.data.f !== null && item.data.f !== undefined ? parseFloat(item.data.f as any) : null;
      const i = item.data.i !== null && item.data.i !== undefined ? parseFloat(item.data.i as any) : null;
      const t = item.data.t !== null && item.data.t !== undefined ? parseFloat(item.data.t as any) : null;
      const r = item.data.r !== null && item.data.r !== undefined ? parseFloat(item.data.r as any) : null;
      const a = item.data.a !== null && item.data.a !== undefined ? parseFloat(item.data.a as any) : null;
      const h = item.data.h !== null && item.data.h !== undefined ? parseFloat(item.data.h as any) : null;

      const values = [f, i, t, r, a, h].filter((val): val is number => val !== null && !isNaN(val));

      const overall =
        values.length > 0
          ? Number((values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(2))
          : null;

      return {
        month: item.month,
        year: item.year,
        f,
        i,
        t,
        r,
        a,
        h,
        overall,
        days_counted: item.data.days_counted,
        hasData: values.length > 0 || item.data.days_counted > 0,
        hasOverall: overall !== null,
      };
    });

  const validPeriods = chronologicalData.filter((d) => d.hasData);
  const validOverallPeriods = chronologicalData.filter((d) => d.hasOverall);
  
  const hasHistory = validPeriods.length > 0;
  const hasEnoughData = validOverallPeriods.length >= 2;
  
  // 1. Data Completeness Warning
  // The latest period is the last element in chronologicalData (which corresponds to historicalData[0])
  const latestPeriod = chronologicalData[chronologicalData.length - 1];
  const latestDaysCounted = latestPeriod ? latestPeriod.days_counted : 0;
  const isLowCompleteness = latestPeriod ? latestDaysCounted < 10 : false;

  // 2. Strongest & Area Penguatan (lowest) based on the latest valid period
  let strongestDimension: { key: string; name: string; score: number } | null = null;
  let weakestDimension: { key: string; name: string; score: number } | null = null;

  const latestValidPeriod = validOverallPeriods[validOverallPeriods.length - 1];
  if (latestValidPeriod) {
    const activeDims: { key: string; name: string; score: number }[] = [];
    FITRAH_DIMENSIONS_CONFIG.forEach((dim) => {
      const score = latestValidPeriod[dim.key];
      if (score !== null && score !== undefined) {
        activeDims.push({
          key: dim.key,
          name: dim.name,
          score,
        });
      }
    });

    if (activeDims.length > 0) {
      const sortedDims = [...activeDims].sort((a, b) => a.score - b.score);
      weakestDimension = sortedDims[0]; // Area Penguatan
      strongestDimension = sortedDims[sortedDims.length - 1]; // Karakter Terkuat
    }
  }

  // 3. Growth Status Card classification
  let latestOverall: number | null = null;
  let earliestOverall: number | null = null;
  let delta: number | null = null;
  let status: "Meningkat" | "Stabil" | "Perlu Perhatian" | "Data Belum Cukup" = "Data Belum Cukup";

  if (hasEnoughData) {
    const earliest = validOverallPeriods[0];
    const latest = validOverallPeriods[validOverallPeriods.length - 1];
    
    earliestOverall = earliest.overall;
    latestOverall = latest.overall;

    if (earliestOverall !== null && latestOverall !== null) {
      delta = Number((latestOverall - earliestOverall).toFixed(2));
      if (delta >= 0.25) {
        status = "Meningkat";
      } else if (delta <= -0.25) {
        status = "Perlu Perhatian";
      } else {
        status = "Stabil";
      }
    }
  }

  // 4. Human-Readable Summary (max 2-3 sentences)
  let growthSummaryText: string | null = null;
  if (hasEnoughData && earliestOverall !== null && latestOverall !== null) {
    const earliest = validOverallPeriods[0];
    const latest = validOverallPeriods[validOverallPeriods.length - 1];

    const improvements: { name: string; diff: number }[] = [];
    const stable: string[] = [];
    const attention: { name: string; diff: number }[] = [];

    FITRAH_DIMENSIONS_CONFIG.forEach((dim) => {
      const earlyVal = earliest[dim.key];
      const lateVal = latest[dim.key];

      if (earlyVal !== null && lateVal !== null) {
        const diff = Number((lateVal - earlyVal).toFixed(2));
        if (diff > 0) {
          improvements.push({ name: dim.name, diff });
        } else if (diff < 0) {
          attention.push({ name: dim.name, diff });
        } else {
          stable.push(dim.name);
        }
      }
    });

    let sentence1 = "";
    if (improvements.length > 0) {
      const sortedImps = [...improvements].sort((a, b) => b.diff - a.diff);
      if (sortedImps.length === 1) {
        sentence1 = `Perkembangan terbesar terlihat pada ${sortedImps[0].name} (+${sortedImps[0].diff}).`;
      } else {
        sentence1 = `Perkembangan terbesar terlihat pada ${sortedImps[0].name} (+${sortedImps[0].diff}) dan ${sortedImps[1].name} (+${sortedImps[1].diff}).`;
      }
    } else {
      sentence1 = "Belum ada dimensi karakter yang menunjukkan peningkatan signifikan pada periode ini.";
    }

    let sentence2 = "";
    if (stable.length > 0) {
      if (stable.length === 1) {
        sentence2 = `${stable[0]} relatif stabil.`;
      } else if (stable.length <= 3) {
        const listStr = stable.slice(0, -1).join(", ") + " dan " + stable[stable.length - 1];
        sentence2 = `Dimensi ${listStr} relatif stabil.`;
      } else {
        sentence2 = "Beberapa dimensi karakter lainnya relatif stabil.";
      }
    }

    let sentence3 = "";
    if (attention.length > 0) {
      const sortedAtt = [...attention].sort((a, b) => a.diff - b.diff); // most negative first
      const first = sortedAtt[0];
      const absDiff = Math.abs(first.diff);
      
      // Map to supportive teacher terms: "perlu perhatian", "perlu penguatan", "perlu pendampingan", "perlu diamati"
      if (sortedAtt.length === 1) {
        sentence3 = `${first.name} menunjukkan penurunan sebesar ${absDiff} poin dan perlu perhatian serta pendampingan lebih lanjut.`;
      } else {
        const second = sortedAtt[1];
        const absDiff2 = Math.abs(second.diff);
        sentence3 = `${first.name} (-${absDiff}) perlu perhatian lebih lanjut, serta ${second.name} (-${absDiff2}) perlu penguatan dan pendampingan.`;
      }
    }

    const sentences = [sentence1, sentence2, sentence3].filter(Boolean);
    growthSummaryText = sentences.join(" ");
  }

  return {
    hasHistory,
    hasEnoughData,
    validPeriodsCount: validOverallPeriods.length,
    latestOverall,
    earliestOverall,
    delta,
    status,
    strongestDimension,
    weakestDimension,
    latestDaysCounted,
    isLowCompleteness,
    growthSummaryText,
  };
}
