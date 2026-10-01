-- =====================================================================
-- CMS Content Seed Script for SIUBA PKBM Baitusyukur
-- Database: bqafeomm_siuba
-- =====================================================================

START TRANSACTION;

-- 1. WEBSITE CONFIGURATION
INSERT INTO website_config (
  id,
  school_name,
  short_name,
  tagline,
  principal_name,
  principal_title,
  principal_greeting,
  contact_phone_raw,
  contact_phone_display,
  contact_email,
  address_street,
  address_village,
  address_district,
  address_regency,
  address_postal_code,
  maps_embed_url,
  social_media,
  seo_defaults,
  theme_branding,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  'SIUBA (Paket A PKBM Baitusyukur Learning Center)',
  'SIUBA',
  'Sekolah Dasar Alternatif Pilihan Utama Berbasis Adab dan Karakter Islami',
  'Ustadz Pengelola',
  'Kepala PKBM Baitusyukur',
  'Pendidikan dasar kesetaraan (Paket A) berbasis adab Islami di bawah lingkungan belajar yang ramah, aman secara psikologis, dan bebas perundungan. Resmi dan diakui negara dengan ijazah setara SD.',
  '+6289655496283',
  '0896-5549-6283',
  'pkbmpaketasiuba@gmail.com',
  'Jl. Letjend Suprapto, Putotan, Sidomulyo',
  'Sidomulyo',
  'Ungaran Timur',
  'Kabupaten Semarang',
  '50514',
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3958.825838530364!2d110.4287848!3d-7.1461936!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e708170c1e84dfb%3A0xe54b9f2d1e089204!2sPKBM%20Baitusyukur!5e0!3m2!1sid!2sid!4v1721500000000!5m2!1sid!2sid',
  '{"instagram":"https://instagram.com/pkbm_baitusyukur","facebook":"","youtube":"","whatsapp":"https://wa.me/6289655496283"}',
  '{"canonical_base_url":"https://siuba.sch.id","default_description":"Pendidikan dasar kesetaraan Paket A berbasis adab Islami resmi diakui negara.","default_keywords":["siuba","paket a","pkbm baitusyukur","sekolah alternatif ungaran"]}',
  '{"brand_font":"plus-jakarta","primary_color":"#10b981","secondary_color":"#065f46"}',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  school_name = VALUES(school_name),
  short_name = VALUES(short_name),
  tagline = VALUES(tagline),
  principal_greeting = VALUES(principal_greeting),
  contact_phone_display = VALUES(contact_phone_display),
  contact_email = VALUES(contact_email),
  updated_at = NOW();

-- 2. NAVIGATION MENUS & LINKS
INSERT INTO navigation_menus (id, name, is_active, created_at)
VALUES 
  ('00000000-0000-0000-0000-000000000201', 'navbar', 1, NOW()),
  ('00000000-0000-0000-0000-000000000202', 'footer', 1, NOW())
ON DUPLICATE KEY UPDATE is_active = 1;

DELETE FROM navigation_links WHERE menu_id IN ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202');

INSERT INTO navigation_links (id, menu_id, parent_id, label, url, sort_order, target, created_at)
VALUES
  (UUID(), '00000000-0000-0000-0000-000000000201', NULL, 'Beranda', '/', 1, '_self', NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000201', NULL, 'Mengapa Kami', '#why-choose-us', 2, '_self', NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000201', NULL, 'Tentang Kami', '#about', 3, '_self', NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000201', NULL, 'Program', '#programs', 4, '_self', NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000201', NULL, 'FAQ', '#faq', 5, '_self', NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000202', NULL, 'Beranda', '/', 1, '_self', NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000202', NULL, 'Mengapa Kami', '#why-choose-us', 2, '_self', NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000202', NULL, 'Tentang Kami', '#about', 3, '_self', NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000202', NULL, 'Program Belajar', '#programs', 4, '_self', NOW());

-- 3. SECTIONS
INSERT INTO sections (id, type, title, subtitle, badge, sort_order, is_active, is_draft, content, draft_content, published_at, created_at, updated_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000301',
    'hero',
    'Mendidik Generasi Beradab, Mandiri, dan Berprestasi',
    'Pendidikan kesetaraan Paket A yang mengintegrasikan adab Islami, kurikulum esensial, dan lingkungan belajar yang aman serta menyenangkan.',
    'Pendidikan Dasar Berkualitas',
    1, 1, 0,
    '{"cta_text":"Daftar Sekarang","cta_url":"https://wa.me/6289655496283","video_text":"Pelajari Lebih Lanjut","video_url":"#about"}',
    '{}', NOW(), NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    'why-choose-us',
    'Mengapa Memilih SIUBA?',
    'Kami menghadirkan ekosistem pendidikan yang berfokus pada perkembangan fitrah anak, akhlak mulia, dan kompetensi masa depan.',
    'Keunggulan Utama',
    2, 1, 0,
    '{}', '{}', NOW(), NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    'about',
    'Mengenal PKBM Baitusyukur Learning Center',
    'SIUBA adalah lembaga pendidikan non-formal resmi yang menyelenggarakan program kesetaraan Paket A dengan pendekatan adab, kurikulum adaptif, serta pembinaan karakter mandiri.',
    'Tentang Kami',
    3, 1, 0,
    '{"accreditation_title":"Terakreditasi & Resmi","accreditation_subtitle":"Ijazah Resmi Negara Setara SD","description":"Kami berkomitmen memberikan pendampingan belajar yang mengutamakan adab sebelum ilmu, hafalan Al-Qur\'an, dan keterampilan hidup esensial."}',
    '{}', NOW(), NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    'programs',
    'Program Pembelajaran Unggulan',
    'Pilihan program belajar terstruktur yang disesuaikan dengan kebutuhan dan potensi unik setiap peserta didik.',
    'Pilihan Program',
    4, 1, 0,
    '{}', '{}', NOW(), NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000305',
    'testimonials',
    'Kata Orang Tua Siswa',
    'Pengalaman nyata para wali santri yang mempercayakan pendidikan ananda di SIUBA.',
    'Testimoni Wali',
    5, 1, 0,
    '{}', '{}', NOW(), NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000306',
    'faq',
    'Pertanyaan yang Sering Diajukan',
    'Temukan jawaban atas pertanyaan umum seputar program, kurikulum, legalitas, dan pendaftaran siswa baru.',
    'Pusat Bantuan',
    6, 1, 0,
    '{}', '{}', NOW(), NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000307',
    'cta',
    'Mari Bergabung Bersama Keluarga Besar SIUBA',
    'Konsultasikan kebutuhan belajar ananda dan dapatkan informasi pendaftaran tahun ajaran baru bersama tim kami.',
    'Pendaftaran Dibuka',
    7, 1, 0,
    '{"cta_text":"Hubungi Kami via WhatsApp","cta_url":"https://wa.me/6289655496283"}',
    '{}', NOW(), NOW(), NOW()
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  badge = VALUES(badge),
  content = VALUES(content),
  is_active = 1,
  is_draft = 0,
  updated_at = NOW();

-- 4. SECTION ITEMS (WHY CHOOSE US & PROGRAMS)
DELETE FROM section_items WHERE section_id IN ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000304');

INSERT INTO section_items (id, section_id, title, subtitle, description, badge, icon, sort_order, created_at, updated_at)
VALUES
  -- Why Choose Us Items
  (UUID(), '00000000-0000-0000-0000-000000000302', 'Berbasis Adab & Sunnah', NULL, 'Menanamkan tauhid, adab keseharian, dan akhlak mulia sebagai pondasi utama sebelum mendalami ilmu.', 'Fondasi Karakter', 'HeartHandshake', 1, NOW(), NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000302', 'Kurikulum Esensial & Bebas Stres', NULL, 'Fokus pada literasi, numerasi, dan nalar kritis tanpa beban tugas berlebihan yang membebani psikologis anak.', 'Bebas Tekanan', 'Smile', 2, NOW(), NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000302', 'Ijazah Resmi Setara SD', NULL, 'Terdaftar di Dapodik Kemdikbudristek, berhak mengikuti asesmen nasional dan melanjutkan ke jenjang SMP/sederajat.', 'Legalitas Resmi', 'Award', 3, NOW(), NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000302', 'Lingkungan Aman & Ramah Anak', NULL, 'Komitmen bebas perundungan (anti-bullying) dengan rasio tutor dan murid yang ideal serta perhatian personal.', 'Kenyamanan', 'ShieldCheck', 4, NOW(), NOW()),
  
  -- Programs Items
  (UUID(), '00000000-0000-0000-0000-000000000304', 'Paket A Reguler (Tatap Muka)', 'Senin - Jumat', 'Program pembelajaran harian terstruktur dengan pendampingan intensif tutor berpengalaman dan aktivitas kelompok yang edukatif.', 'Program Unggulan', 'BookOpen', 1, NOW(), NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000304', 'Tahfidz & Penguatan Karakter', 'Integrasi Harian', 'Bimbingan tahsin metode teruji, hafalan juz amma, serta pembiasaan ibadah praktis seperti sholat berjamaah dan doa harian.', 'Karakter Islami', 'Sparkles', 2, NOW(), NOW()),
  (UUID(), '00000000-0000-0000-0000-000000000304', 'Eksplorasi Minat & Life Skills', 'Aktivitas Tematik', 'Pembelajaran tematik berbasis proyek sederhana, sains aplikatif, olahraga, seni kriya, dan kemandirian hidup sehari-hari.', 'Kreativitas', 'Compass', 3, NOW(), NOW());

-- 5. FAQS
DELETE FROM faqs;
INSERT INTO faqs (id, question, answer, sort_order, is_active, created_at, updated_at)
VALUES
  (UUID(), 'Apakah ijazah lulusan SIUBA Paket A diakui negara?', 'Ya, sangat diakui. SIUBA bernaung di bawah PKBM resmi yang terdaftar di Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. Lulusan memperoleh ijazah resmi kesetaraan yang dapat digunakan untuk mendaftar ke SMP Negeri, Swasta, maupun Pondok Pesantren.', 1, 1, NOW(), NOW()),
  (UUID(), 'Bagaimana pendekatan pembelajaran di SIUBA?', 'Kami menggunakan kurikulum esensial berbasis adab Islami. Suasana belajar didesain ramah anak, berpusat pada minat siswa, dan tanpa tekanan tugas berlebihan sehingga ananda senang belajar.', 2, 1, NOW(), NOW()),
  (UUID(), 'Apakah ada program hafalan Al-Qur\'an (Tahfidz)?', 'Ya, setiap siswa mendapatkan bimbingan tahsin dan tahfidz harian yang disesuaikan dengan kemampuan masing-masing anak secara bertahap.', 3, 1, NOW(), NOW()),
  (UUID(), 'Apakah siswa pindahan dari SD formal bisa mendaftar?', 'Bisa. Kami menerima siswa pindahan dari sekolah formal maupun homeschooling dengan proses administrasi mutasi resmi melalui sistem Dapodik.', 4, 1, NOW(), NOW()),
  (UUID(), 'Bagaimana cara mendaftar di SIUBA?', 'Pendaftaran dapat dilakukan secara online dengan menghubungi nomor WhatsApp resmi kami atau datang langsung ke kantor PKBM Baitusyukur pada jam operasional.', 5, 1, NOW(), NOW());

-- 6. TESTIMONIALS
DELETE FROM testimonials;
INSERT INTO testimonials (id, name, role, quote, sort_order, is_active, created_at, updated_at)
VALUES
  (UUID(), 'Ummu Faris', 'Wali Santri Kelas 4', 'Alhamdulillah sejak belajar di SIUBA, ananda jauh lebih ceria dan mandiri. Adab sholat dan sopan santunnya berkembang sangat pesat.', 1, 1, NOW(), NOW()),
  (UUID(), 'Abu Maryam', 'Wali Santri Kelas 2', 'Lingkungan belajarnya sangat ramah dan menenangkan. Tutornya sabar membimbing anak-anak dengan pendekatan personal yang tulus.', 2, 1, NOW(), NOW()),
  (UUID(), 'Bunda Keanu', 'Wali Santri Kelas 1', 'Sangat bersyukur menemukan sekolah alternatif yang memperhatikan adab sebelum ilmu. Fasilitas dan legalitasnya pun jelas serta terpercaya.', 3, 1, NOW(), NOW());

COMMIT;
