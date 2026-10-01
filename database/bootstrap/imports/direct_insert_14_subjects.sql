-- =====================================================================
-- Direct Insert 14 Mata Pelajaran (Subjects)
-- Database: bqafeomm_siuba
-- =====================================================================

INSERT INTO subjects (id, code, name, description, status, lifecycle_status, created_at, updated_at)
VALUES
  (UUID(), 'THD', 'Tauhid/Akidah', 'Mata pelajaran Tauhid dan Akidah Islam', 'active', 'active', NOW(), NOW()),
  (UUID(), 'AKH', 'Adab/Akhlak', 'Mata pelajaran Adab dan Akhlak Islami', 'active', 'active', NOW(), NOW()),
  (UUID(), 'FQH', 'Fiqih', 'Mata pelajaran Fiqih Ibadah', 'active', 'active', NOW(), NOW()),
  (UUID(), 'SRH', 'Sirah', 'Mata pelajaran Sirah Nabawiyah dan Sejarah Islam', 'active', 'active', NOW(), NOW()),
  (UUID(), 'HDT', 'Hadits', 'Mata pelajaran Hadits Pilihan', 'active', 'active', NOW(), NOW()),
  (UUID(), 'BIN', 'Bahasa Indonesia', 'Mata pelajaran Bahasa Indonesia', 'active', 'active', NOW(), NOW()),
  (UUID(), 'MTK', 'Matematika', 'Mata pelajaran Matematika', 'active', 'active', NOW(), NOW()),
  (UUID(), 'BIG', 'Bahasa Inggris', 'Mata pelajaran Bahasa Inggris', 'active', 'active', NOW(), NOW()),
  (UUID(), 'BAR', 'Bahasa Arab', 'Mata pelajaran Bahasa Arab', 'active', 'active', NOW(), NOW()),
  (UUID(), 'IPAS', 'IPAS', 'Ilmu Pengetahuan Alam dan Sosial', 'active', 'active', NOW(), NOW()),
  (UUID(), 'PKN', 'Pancasila', 'Pendidikan Pancasila dan Kewarganegaraan', 'active', 'active', NOW(), NOW()),
  (UUID(), 'BJW', 'Bahasa Jawa', 'Muatan Lokal Bahasa Jawa', 'active', 'active', NOW(), NOW()),
  (UUID(), 'PJOK', 'PJOK', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'active', 'active', NOW(), NOW()),
  (UUID(), 'SNI', 'Seni', 'Pendidikan Seni dan Budaya', 'active', 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), status = 'active', lifecycle_status = 'active';
