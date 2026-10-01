-- =====================================================================
-- Direct Enrollment Script: 133 Siswa ke Kelas Masing-masing
-- Jalankan di phpMyAdmin database bqafeomm_siuba
-- =====================================================================

INSERT INTO student_enrollments (
  id,
  student_id,
  class_id,
  academic_year_id,
  semester_id,
  status,
  lifecycle_status,
  enrolled_at,
  created_at,
  updated_at
)
SELECT 
  UUID(),
  s.id,
  c.id,
  ay.id,
  sem.id,
  'active',
  'active',
  NOW(),
  NOW(),
  NOW()
FROM (
  SELECT '3199426524' AS nisn, '1A' AS class_code UNION ALL
  SELECT '3198422794' AS nisn, '1A' AS class_code UNION ALL
  SELECT '3190000001' AS nisn, '1A' AS class_code UNION ALL
  SELECT '9900000001' AS nisn, '1A' AS class_code UNION ALL
  SELECT '3190357803' AS nisn, '1A' AS class_code UNION ALL
  SELECT '3209796373' AS nisn, '1A' AS class_code UNION ALL
  SELECT '3187424021' AS nisn, '1A' AS class_code UNION ALL
  SELECT '3206762228' AS nisn, '1A' AS class_code UNION ALL
  SELECT '3204503597' AS nisn, '1A' AS class_code UNION ALL
  SELECT '3198092424' AS nisn, '1A' AS class_code UNION ALL
  SELECT '3205627755' AS nisn, '1A' AS class_code UNION ALL
  SELECT '9900000002' AS nisn, '1B' AS class_code UNION ALL
  SELECT '9900000003' AS nisn, '1B' AS class_code UNION ALL
  SELECT '9900000004' AS nisn, '1B' AS class_code UNION ALL
  SELECT '3192258152' AS nisn, '1B' AS class_code UNION ALL
  SELECT '3198281461' AS nisn, '1B' AS class_code UNION ALL
  SELECT '3207080339' AS nisn, '1B' AS class_code UNION ALL
  SELECT '3203756024' AS nisn, '1B' AS class_code UNION ALL
  SELECT '3205615589' AS nisn, '1B' AS class_code UNION ALL
  SELECT '9900000005' AS nisn, '1B' AS class_code UNION ALL
  SELECT '3209794078' AS nisn, '1B' AS class_code UNION ALL
  SELECT '3183850167' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3181944199' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3181975906' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3189082673' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3186460478' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3191259074' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3187843285' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3189483631' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3180321112' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3181573542' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3198259156' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3182354015' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3192494309' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3190629154' AS nisn, '2A' AS class_code UNION ALL
  SELECT '3195013697' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3184630913' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3189096433' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3189828549' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3184967547' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3187294976' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3199724131' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3181581720' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3186803777' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3195941543' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3184329435' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3199033453' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3199343916' AS nisn, '2B' AS class_code UNION ALL
  SELECT '3188177630' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3180087712' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3170944878' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3170797855' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3170580345' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3184753356' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3176337594' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3177380785' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3181636963' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3174092186' AS nisn, '3A' AS class_code UNION ALL
  SELECT '3189680481' AS nisn, '3B' AS class_code UNION ALL
  SELECT '3177324007' AS nisn, '3B' AS class_code UNION ALL
  SELECT '3179306797' AS nisn, '3B' AS class_code UNION ALL
  SELECT '3174708838' AS nisn, '3B' AS class_code UNION ALL
  SELECT '3174470300' AS nisn, '3B' AS class_code UNION ALL
  SELECT '3183989429' AS nisn, '3B' AS class_code UNION ALL
  SELECT '3187886820' AS nisn, '3B' AS class_code UNION ALL
  SELECT '3171173559' AS nisn, '3B' AS class_code UNION ALL
  SELECT '3183306186' AS nisn, '3B' AS class_code UNION ALL
  SELECT '3172431544' AS nisn, '3B' AS class_code UNION ALL
  SELECT '9900000006' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3176367350' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3168978073' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3161578050' AS nisn, '4A' AS class_code UNION ALL
  SELECT '9900000007' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3166219023' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3165936846' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3164135617' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3174692041' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3162567267' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3165944580' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3152919872' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3179835828' AS nisn, '4A' AS class_code UNION ALL
  SELECT '9900000008' AS nisn, '4A' AS class_code UNION ALL
  SELECT '3168071112' AS nisn, '4B' AS class_code UNION ALL
  SELECT '3176377131' AS nisn, '4B' AS class_code UNION ALL
  SELECT '3172286001' AS nisn, '4B' AS class_code UNION ALL
  SELECT '9900000009' AS nisn, '4B' AS class_code UNION ALL
  SELECT '9900000010' AS nisn, '4B' AS class_code UNION ALL
  SELECT '3178153607' AS nisn, '4B' AS class_code UNION ALL
  SELECT '3169013563' AS nisn, '4B' AS class_code UNION ALL
  SELECT '3173772378' AS nisn, '4B' AS class_code UNION ALL
  SELECT '3164223367' AS nisn, '4B' AS class_code UNION ALL
  SELECT '3168139070' AS nisn, '4B' AS class_code UNION ALL
  SELECT '9900000011' AS nisn, '4B' AS class_code UNION ALL
  SELECT '3168774159' AS nisn, '4B' AS class_code UNION ALL
  SELECT '3169434233' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '0169005105' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '3169335849' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '3169565385' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '3155684253' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '0166187047' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '3160906715' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '3168592559' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '3158499212' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '0164351504' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '3168236112' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '3154504623' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '3160160162' AS nisn, '5AKH' AS class_code UNION ALL
  SELECT '0164121212' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3154424475' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3168709574' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3154593583' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3155494686' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3158023077' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3148619567' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3155098871' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3162822095' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3154710920' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3156057086' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3152731519' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3167511415' AS nisn, '5IKH' AS class_code UNION ALL
  SELECT '3147255270' AS nisn, '6' AS class_code UNION ALL
  SELECT '0141712507' AS nisn, '6' AS class_code UNION ALL
  SELECT '3148455221' AS nisn, '6' AS class_code UNION ALL
  SELECT '3151952215' AS nisn, '6' AS class_code UNION ALL
  SELECT '0145968967' AS nisn, '6' AS class_code UNION ALL
  SELECT '0131893667' AS nisn, '6' AS class_code UNION ALL
  SELECT '3158514155' AS nisn, '6' AS class_code UNION ALL
  SELECT '0133134671' AS nisn, '6' AS class_code UNION ALL
  SELECT '0151372625' AS nisn, '6' AS class_code UNION ALL
  SELECT '3147821323' AS nisn, '6' AS class_code UNION ALL
  SELECT '3151489627' AS nisn, '6' AS class_code UNION ALL
  SELECT '0146044325' AS nisn, '6' AS class_code UNION ALL
  SELECT '3147484867' AS nisn, '6' AS class_code
) map
JOIN students s ON s.nisn = map.nisn
JOIN classes c ON c.code = map.class_code
JOIN academic_years ay ON ay.is_active = 1 AND ay.lifecycle_status != 'soft_deleted'
JOIN semesters sem ON sem.is_active = 1 AND sem.lifecycle_status != 'soft_deleted'
ON DUPLICATE KEY UPDATE updated_at = NOW();
