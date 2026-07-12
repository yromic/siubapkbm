async function runFinanceAttendanceDashboardTests() {
  const baseUrl = 'http://localhost:3000';
  let adminToken = '';
  let teacherToken = '';
  
  let activeYearId = '';
  let activeSemesterId = '';
  let class10A_Id = '';
  let teacherBudiId = '';
  
  let studentDaniId = '';
  
  let sppPaymentId = '';
  let importId = '';
  let exportId = '';
  
  let targetSemesterId = '';
  let class11A_Id = '';
  let ruleId = '';

  console.log('--- 1. Login Admin ---');
  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  adminToken = loginData.data.token;
  console.log('Admin Token retrieved:', adminToken ? 'YES' : 'NO');

  // Query periods, classes and subjects
  console.log('\n--- Query Periods, Classes & Subjects ---');
  const semRes = await fetch(`${baseUrl}/api/v1/semesters`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const semData = await semRes.json();
  const currentSemester = semData.data.data[0];
  activeSemesterId = currentSemester.id;
  activeYearId = currentSemester.academic_year_id;
  console.log('Semester ID:', activeSemesterId, 'Year ID:', activeYearId);

  const classesRes = await fetch(`${baseUrl}/api/v1/classes`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const classesData = await classesRes.json();
  const class10A = classesData.data.data.find(c => c.code === 'K10A');
  class10A_Id = class10A.id;
  console.log('Kelas 10A ID:', class10A_Id);

  // Get student Ahmad Dani ID
  console.log('\n--- Query Ahmad Dani ---');
  const studentsRes = await fetch(`${baseUrl}/api/v1/students?search=Ahmad Dani`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const studentsData = await studentsRes.json();
  studentDaniId = studentsData.data.data[0].id;
  console.log('Ahmad Dani ID:', studentDaniId);

  // Login gurubudi
  console.log('\n--- Login gurubudi ---');
  const loginGuruRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'gurubudi', password: 'budi123' })
  });
  const loginGuruData = await loginGuruRes.json();
  teacherToken = loginGuruData.data.token;
  teacherBudiId = loginGuruData.data.user.id;
  console.log('gurubudi Token:', teacherToken ? 'YES' : 'NO', 'ID:', teacherBudiId);

  // ==========================================
  // SPP Payments Skenario
  // ==========================================
  console.log('\n--- 2. SPP Payments Skenario ---');
  const sppListRes = await fetch(`${baseUrl}/api/v1/finance/spp?student_id=${studentDaniId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const sppListData = await sppListRes.json();
  console.log('Total SPP records found for Ahmad Dani:', sppListData.data.data.length);
  const unpaidRecord = sppListData.data.data.find(s => s.payment_status === 'unpaid');
  console.log('First Unpaid Month:', unpaidRecord.payment_month, 'Year:', unpaidRecord.payment_year);

  // Verify SPP payment
  console.log('\n--- Verify SPP Payment ---');
  const verifyRes = await fetch(`${baseUrl}/api/v1/finance/spp/verify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      student_id: studentDaniId,
      amount_paid: unpaidRecord.amount_due,
      payment_method: 'Transfer Bank',
      notes: 'Lunas Bulan Pertama',
      payment_month: unpaidRecord.payment_month,
      payment_year: unpaidRecord.payment_year
    })
  });
  const verifyData = await verifyRes.json();
  console.log('Verify HTTP Status:', verifyRes.status, 'Status Result:', verifyData.data[0].payment_status);
  sppPaymentId = verifyData.data[0].id;

  // Revert payment
  console.log('\n--- Revert SPP Payment ---');
  const revertRes = await fetch(`${baseUrl}/api/v1/finance/spp/${sppPaymentId}/revert`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const revertData = await revertRes.json();
  console.log('Revert HTTP Status:', revertRes.status, 'Status Result:', revertData.data.payment_status);

  // ==========================================
  // Geolocation Attendance Skenario
  // ==========================================
  console.log('\n--- 3. Geolocation Attendance Skenario ---');
  // Record check-in close to school (coordinate: -6.2001, 106.8165)
  const attRes = await fetch(`${baseUrl}/api/v1/attendance`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${teacherToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ lat: -6.2001, lng: 106.8165 })
  });
  const attData = await attRes.json();
  console.log('Record Attendance Status:', attRes.status, 'Result Status:', attData.data?.status, 'Distance:', attData.data?.distance_meters, 'meters');

  // Retrieve my attendance history
  const myAttRes = await fetch(`${baseUrl}/api/v1/attendance/my`, {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  const myAttData = await myAttRes.json();
  console.log('My Attendance history records count:', myAttData.data?.length);

  // Record manual check-in by admin
  const manualAttRes = await fetch(`${baseUrl}/api/v1/attendance/manual`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      target_teacher_id: teacherBudiId,
      date: '2026-07-08',
      status: 'present'
    })
  });
  const manualAttData = await manualAttRes.json();
  console.log('Manual Attendance Status:', manualAttRes.status, 'Result Status:', manualAttData.data?.status);

  // Daily roster
  const todayStr = new Date().toISOString().split('T')[0];
  const rosterRes = await fetch(`${baseUrl}/api/v1/attendance/roster?date=${todayStr}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const rosterData = await rosterRes.json();
  console.log('Roster list for today counts:', rosterData.data?.length);

  // ==========================================
  // Dashboard & Completeness Skenario
  // ==========================================
  console.log('\n--- 4. Dashboard & Completeness Skenario ---');
  const dashRes = await fetch(`${baseUrl}/api/v1/dashboards/school`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const dashData = await dashRes.json();
  console.log('School Dashboard total students:', dashData.data?.total_students, 'total teachers:', dashData.data?.total_teachers);

  const classDashRes = await fetch(`${baseUrl}/api/v1/dashboards/classes/${class10A_Id}?academic_year_id=${activeYearId}&semester_id=${activeSemesterId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const classDashData = await classDashRes.json();
  console.log('Class Dashboard students count:', classDashData.data?.total_students, 'Academic Completeness:', classDashData.data?.academic_completeness, '%');

  const compRes = await fetch(`${baseUrl}/api/v1/completeness/teachers?academic_year_id=${activeYearId}&semester_id=${activeSemesterId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const compData = await compRes.json();
  console.log('Teachers completeness log entry count:', compData.data?.length);

  // ==========================================
  // Import Wizard Skenario
  // ==========================================
  console.log('\n--- 5. Import Wizard Skenario ---');
  // Get CSV Template
  const templateRes = await fetch(`${baseUrl}/api/v1/imports/templates/student`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('Download Template Status:', templateRes.status);

  // Upload student import
  const csvContent = "nisn,full_name,birth_date,gender\n9999999999,Siswa Impor Baru,2011-08-20,L\n";
  const base64Content = Buffer.from(csvContent).toString('base64');
  const importUploadRes = await fetch(`${baseUrl}/api/v1/imports`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      import_type: 'student',
      file_name: 'test-student-import.csv',
      file_content_base64: base64Content
    })
  });
  const importUploadData = await importUploadRes.json();
  importId = importUploadData.data.import_id;
  console.log('Import Uploaded, ID:', importId);

  // Get preview
  const previewRes = await fetch(`${baseUrl}/api/v1/imports/${importId}/preview`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const previewData = await previewRes.json();
  console.log('Preview Columns:', previewData.data.columns, 'Rows count:', previewData.data.rows.length, 'Errors count:', previewData.data.errors.length);

  // Confirm import
  const confirmRes = await fetch(`${baseUrl}/api/v1/imports/${importId}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const confirmData = await confirmRes.json();
  console.log('Confirm HTTP Status:', confirmRes.status, 'Job Status:', confirmData.data?.status);

  // Check student imported
  const searchStudentRes = await fetch(`${baseUrl}/api/v1/students?search=Siswa Impor Baru`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const searchStudentData = await searchStudentRes.json();
  console.log('Imported Student NISN in DB:', searchStudentData.data?.data[0]?.nisn);

  // ==========================================
  // Rollover & Promotion Skenario
  // ==========================================
  console.log('\n--- 6. Rollover & Promotion Skenario ---');
  // Create second semester (Semester Genap) for rollover target
  const createSemRes = await fetch(`${baseUrl}/api/v1/semesters`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      academic_year_id: activeYearId,
      name: 'Semester Genap',
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      type: 'genap'
    })
  });
  const createSemData = await createSemRes.json();
  targetSemesterId = createSemData.data.id;
  console.log('Semester Genap created ID:', targetSemesterId);

  // Rollover Preview
  const rolloverPreviewRes = await fetch(`${baseUrl}/api/v1/rollovers/assignments/preview`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_semester_id: activeSemesterId,
      target_semester_id: targetSemesterId
    })
  });
  const rolloverPreviewData = await rolloverPreviewRes.json();
  console.log('Rollover preview assignments count:', rolloverPreviewData.data.assignments.length, 'class subjects count:', rolloverPreviewData.data.class_subjects.length);

  // Rollover Execute
  const rolloverExecRes = await fetch(`${baseUrl}/api/v1/rollovers/assignments/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_semester_id: activeSemesterId,
      target_semester_id: targetSemesterId
    })
  });
  const rolloverExecData = await rolloverExecRes.json();
  console.log('Rollover execute copied assignments:', rolloverExecData.data.copied_assignments, 'copied subjects:', rolloverExecData.data.copied_subjects);

  // Promotion: Create Kelas 11A target
  const createClassRes = await fetch(`${baseUrl}/api/v1/classes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: 'K11A',
      name: 'Kelas 11A',
      level: 11
    })
  });
  const createClassData = await createClassRes.json();
  class11A_Id = createClassData.data.id;
  console.log('Kelas 11A created ID:', class11A_Id);

  // Create promotion rule
  const ruleRes = await fetch(`${baseUrl}/api/v1/promotion-rules`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_class_id: class10A_Id,
      target_class_id: class11A_Id
    })
  });
  const ruleData = await ruleRes.json();
  ruleId = ruleData.data.id;
  console.log('Promotion rule created ID:', ruleId);

  // Preview Student Promotion
  const promoPreviewRes = await fetch(`${baseUrl}/api/v1/promotions/students/preview`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_class_id: class10A_Id,
      target_class_id: class11A_Id,
      academic_year_id: activeYearId,
      semester_id: targetSemesterId
    })
  });
  const promoPreviewData = await promoPreviewRes.json();
  console.log('Promotion preview eligible students count:', promoPreviewData.data.eligible_students.length);

  // Execute Student Promotion
  const promoExecRes = await fetch(`${baseUrl}/api/v1/promotions/students/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_class_id: class10A_Id,
      target_class_id: class11A_Id,
      student_ids: [studentDaniId],
      academic_year_id: activeYearId,
      semester_id: targetSemesterId
    })
  });
  const promoExecData = await promoExecRes.json();
  console.log('Promotion execute promoted count:', promoExecData.data.promoted_count);

  // ==========================================
  // Export, Snapshots & Finalization Skenario
  // ==========================================
  console.log('\n--- 7. Export, Snapshots & Finalization Skenario ---');
  // Export report
  const exportRes = await fetch(`${baseUrl}/api/v1/exports/students/${studentDaniId}/full`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      academic_year_id: activeYearId,
      semester_id: activeSemesterId
    })
  });
  const exportData = await exportRes.json();
  exportId = exportData.data.export_id;
  console.log('Export report created, ID:', exportId);

  // Download export report
  const downloadRes = await fetch(`${baseUrl}/api/v1/exports/${exportId}/download`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('Download export report HTTP Status:', downloadRes.status, 'Content-Length:', downloadRes.headers.get('content-length'));

  // Snapshot Student report
  const snapRes = await fetch(`${baseUrl}/api/v1/snapshots/students/${studentDaniId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      academic_year_id: activeYearId,
      semester_id: activeSemesterId
    })
  });
  const snapData = await snapRes.json();
  console.log('Report snapshot created student name:', snapData.data.student_name);

  // Lookup snapshot
  const lookupSnapRes = await fetch(`${baseUrl}/api/v1/snapshots?student_id=${studentDaniId}&academic_year_id=${activeYearId}&semester_id=${activeSemesterId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const lookupSnapData = await lookupSnapRes.json();
  console.log('Lookup snapshot student name:', lookupSnapData.data.student_name);

  // Finalize Semester
  const finalizeRes = await fetch(`${baseUrl}/api/v1/semesters/${activeSemesterId}/finalize`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const finalizeData = await finalizeRes.json();
  console.log('Finalize Semester HTTP Status:', finalizeRes.status, 'Message:', finalizeData.message);

  // Finalization Status
  const finStatusRes = await fetch(`${baseUrl}/api/v1/semesters/${activeSemesterId}/finalization-status`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const finStatusData = await finStatusRes.json();
  console.log('Finalization Status is_finalized:', finStatusData.data.is_finalized, 'Snapshots created:', finStatusData.data.total_snapshots);
}

runFinanceAttendanceDashboardTests();
