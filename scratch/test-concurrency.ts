import { db } from "../lib/db";
import {
  getClassAttendance,
  saveClassAttendance,
} from "../lib/services/studentAttendanceService";

async function main() {
  const teacherFarisId = "9284f530-dea8-4dd8-8207-bd5edebf6980";
  const class1Id = "25345b5c-28e0-442c-9591-6922a2db405a";
  const testDate = "2026-09-13";

  await db("student_attendance_sessions")
    .where({ class_id: class1Id, attendance_date: testDate })
    .del();

  const initial = await getClassAttendance(class1Id, testDate, { id: teacherFarisId, role: "teacher" });

  const payloadA = {
    attendance_date: testDate,
    records: initial.records.map((r: any, i: number) => ({
      student_id: r.student_id,
      status: i === 0 ? ("sakit" as const) : ("hadir" as const),
      note: i === 0 ? "Payload A" : null,
    })),
  };

  const payloadB = {
    attendance_date: testDate,
    records: initial.records.map((r: any, i: number) => ({
      student_id: r.student_id,
      status: i === 1 ? ("izin" as const) : ("hadir" as const),
      note: i === 1 ? "Payload B" : null,
    })),
  };

  const results = await Promise.allSettled([
    saveClassAttendance(class1Id, payloadA, { id: teacherFarisId, role: "teacher", name: "Faris" }),
    saveClassAttendance(class1Id, payloadB, { id: teacherFarisId, role: "teacher", name: "Faris" }),
  ]);

  const sessions = await db("student_attendance_sessions")
    .where({ class_id: class1Id, attendance_date: testDate });

  const records = await db("student_attendance_records")
    .where({ session_id: sessions[0]?.id });

  await db("student_attendance_sessions")
    .where({ class_id: class1Id, attendance_date: testDate })
    .del();

  process.exit(0);
}

main().catch(() => {
  process.exit(1);
});
