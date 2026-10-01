-- =====================================================================
-- Direct Teacher / Tutor Accounts Insert
-- Database: bqafeomm_siuba
-- Default Password: GuruSiuba2026!
-- =====================================================================

START TRANSACTION;

-- Guru 1: Alamsyah Arsyad (Username: alamsyah)
SET @u_alamsyah = UUID();
SET @p_alamsyah = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_alamsyah, 'Alamsyah Arsyad', 'alamsyah93506@pendidik.kesetaraan.belajar.id', 'alamsyah', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '089627799799', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_alamsyah, id, 'Alamsyah Arsyad', 'L', '089627799799', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'alamsyah'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 2: Budi Haryawan (Username: budi)
SET @u_budi = UUID();
SET @p_budi = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_budi, 'Budi Haryawan', 'budi55405@pendidik.kesetaraan.belajar.id', 'budi', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '081575032541', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_budi, id, 'Budi Haryawan', 'L', '081575032541', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'budi'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 3: Desy Ramadhani (Username: desy)
SET @u_desy = UUID();
SET @p_desy = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_desy, 'Desy Ramadhani', 'desy.ramadhani135@pendidik.kesetaraan.belajar.id', 'desy', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '082138517981', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_desy, id, 'Desy Ramadhani', 'P', '082138517981', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'desy'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 4: Dewi Mualifah (Username: dewi)
SET @u_dewi = UUID();
SET @p_dewi = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_dewi, 'Dewi Mualifah', 'dewi.mualifah48@pendidik.kesetaraan.belajar.id', 'dewi', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '083836504522', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_dewi, id, 'Dewi Mualifah', 'P', '083836504522', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'dewi'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 5: Faris Achmad Kurnia Fajri (Username: faris)
SET @u_faris = UUID();
SET @p_faris = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_faris, 'Faris Achmad Kurnia Fajri', 'faris32344@pendidik.kesetaraan.belajar.id', 'faris', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '081329022915', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_faris, id, 'Faris Achmad Kurnia Fajri', 'L', '081329022915', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'faris'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 6: Lailatul Qodriyah Kautsari (Username: lailatul)
SET @u_lailatul = UUID();
SET @p_lailatul = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_lailatul, 'Lailatul Qodriyah Kautsari', 'lailatul81361@pendidik.kesetaraan.belajar.id', 'lailatul', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '082137162406', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_lailatul, id, 'Lailatul Qodriyah Kautsari', 'P', '082137162406', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'lailatul'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 7: Nur Arifuddin (Username: nur)
SET @u_nur = UUID();
SET @p_nur = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_nur, 'Nur Arifuddin', 'nur94622@pendidik.kesetaraan.belajar.id', 'nur', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '085712261564', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_nur, id, 'Nur Arifuddin', 'L', '085712261564', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'nur'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 8: Royani (Username: royani)
SET @u_royani = UUID();
SET @p_royani = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_royani, 'Royani', 'royani00346@pendidik.kesetaraan.belajar.id', 'royani', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '087722076962', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_royani, id, 'Royani', 'P', '087722076962', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'royani'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 9: Rumiyati (Username: rumiyati)
SET @u_rumiyati = UUID();
SET @p_rumiyati = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_rumiyati, 'Rumiyati', 'rumiyati.214@pendidik.kesetaraan.belajar.id', 'rumiyati', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '081901663934', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_rumiyati, id, 'Rumiyati', 'P', '081901663934', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'rumiyati'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 10: Suyatman (Username: suyatman)
SET @u_suyatman = UUID();
SET @p_suyatman = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_suyatman, 'Suyatman', 'suyatman16393@admin.kesetaraan.belajar.id', 'suyatman', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '085640668884', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_suyatman, id, 'Suyatman', 'L', '085640668884', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'suyatman'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 11: Tri Joko Suprapto (Username: tri)
SET @u_tri = UUID();
SET @p_tri = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_tri, 'Tri Joko Suprapto', 'tri06381@pendidik.kesetaraan.belajar.id', 'tri', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '085701566435', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_tri, id, 'Tri Joko Suprapto', 'L', '085701566435', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'tri'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

-- Guru 12: Ahmad Kamal (Username: ahmad)
SET @u_ahmad = UUID();
SET @p_ahmad = UUID();
INSERT INTO users (id, name, email, username, password_hash, role, phone, status, failed_login_attempts, lifecycle_status, created_at, updated_at)
VALUES (@u_ahmad, 'Ahmad Kamal', 'ahmad.kamal@pendidik.kesetaraan.belajar.id', 'ahmad', '$2b$10$U.zgfwU8HUOqhdHWWxked.hMiI6asYn4S/mPU3hxvl89WcWfv1pNC', 'teacher', '081998089474', 'active', 0, 'active', NOW(), NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), role = 'teacher', status = 'active';
INSERT INTO teacher_profiles (id, user_id, full_name, gender, phone, position, status, lifecycle_status, created_at, updated_at)
SELECT @p_ahmad, id, 'Ahmad Kamal', 'L', '081998089474', 'Tutor / Guru Pengajar', 'active', 'active', NOW(), NOW()
FROM users WHERE username = 'ahmad'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), gender = VALUES(gender), phone = VALUES(phone), position = VALUES(position);

COMMIT;
