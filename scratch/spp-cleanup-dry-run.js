/**
 * Script: spp-cleanup-dry-run.js
 * 
 * Jalankan dry run cleanup ghost arrears SPP.
 * 
 * Usage:
 *   node scratch/spp-cleanup-dry-run.js                      (preview semua siswa)
 *   node scratch/spp-cleanup-dry-run.js 3183850167           (preview satu siswa)
 *   node scratch/spp-cleanup-dry-run.js --execute            (eksekusi hapus semua)
 *   node scratch/spp-cleanup-dry-run.js 3183850167 --execute (eksekusi satu siswa)
 */

const BASE_URL = 'http://localhost:3000';

const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');
// studentNisn hanya jika argumen pertama ada dan BUKAN '--execute'
const studentNisn = (args[0] && args[0] !== '--execute') ? args[0] : undefined;

async function run() {
  // --- Step 1: Login (sistem menggunakan cookie-based auth) ---
  console.log('🔐 Login sebagai admin...');
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'admin123' })
  });

  if (!loginRes.ok) {
    console.error('❌ Login gagal. Pastikan dev server berjalan di localhost:3000');
    const errBody = await loginRes.json().catch(() => ({}));
    console.error('   Response:', JSON.stringify(errBody, null, 2));
    process.exit(1);
  }

  // Sistem pakai cookie-based session — ambil Set-Cookie dari response login
  const setCookieHeader = loginRes.headers.get('set-cookie');
  if (!setCookieHeader) {
    console.error('❌ Cookie sesi tidak ditemukan di response login.');
    process.exit(1);
  }
  const cookieMatch = setCookieHeader.match(/staff_session_token=([^;]+)/);
  if (!cookieMatch) {
    console.error('❌ staff_session_token tidak ditemukan di Set-Cookie header.');
    console.error('   Set-Cookie:', setCookieHeader);
    process.exit(1);
  }
  const sessionCookie = `staff_session_token=${cookieMatch[1]}`;
  console.log('✅ Login berhasil.');

  // --- Step 2: Panggil endpoint cleanup-ghost ---
  const body = {
    dry_run: isDryRun,
    ...(studentNisn ? { student_nisn: studentNisn } : {})
  };

  console.log('\n📋 Request:');
  console.log('   URL  :', `${BASE_URL}/api/v1/finance/spp/cleanup-ghost`);
  console.log('   Body :', JSON.stringify(body));
  console.log('   Mode :', isDryRun ? '🔍 DRY RUN (tidak ada perubahan data)' : '🗑️  EXECUTE (akan soft-delete record)');
  if (studentNisn) console.log('   NISN :', studentNisn);
  console.log('');

  const cleanupRes = await fetch(`${BASE_URL}/api/v1/finance/spp/cleanup-ghost`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie   // ← cookie session, bukan Bearer token
    },
    body: JSON.stringify(body)
  });

  const result = await cleanupRes.json();

  if (!cleanupRes.ok) {
    console.error('❌ Request gagal. Status:', cleanupRes.status);
    console.error('   Response:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  // --- Step 3: Tampilkan hasil ---
  console.log('═══════════════════════════════════════════════════════');

  if (isDryRun) {
    const total = result.data?.total_ghost_records ?? 0;
    console.log(`🔍 DRY RUN SELESAI — ditemukan ${total} ghost arrear record`);

    if (total === 0) {
      console.log('✅ Tidak ada tagihan hantu. Data sudah bersih.');
    } else {
      console.log('\n📊 Detail record terdampak:\n');
      const preview = result.data?.preview ?? [];
      preview.forEach((r, i) => {
        const enrollDate = new Date(r.enrollment_created_at);
        console.log(`  [${i + 1}] ${r.student_name} (NISN: ${r.student_nisn})`);
        console.log(`       Bulan tagihan hantu : ${r.ghost_month}/${r.ghost_year}`);
        console.log(`       Nominal             : Rp ${Number(r.amount_due).toLocaleString('id-ID')}`);
        console.log(`       Tanggal enrollment  : ${enrollDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`);
        console.log(`       SPP Payment ID      : ${r.spp_payment_id}`);
        console.log('');
      });

      console.log('═══════════════════════════════════════════════════════');
      console.log(`\n⚠️  Untuk menghapus ${total} record ini, jalankan:`);
      if (studentNisn) {
        console.log(`   node scratch/spp-cleanup-dry-run.js ${studentNisn} --execute`);
      } else {
        console.log(`   node scratch/spp-cleanup-dry-run.js --execute`);
      }
    }
  } else {
    const total = result.data?.total_soft_deleted ?? 0;
    console.log(`🗑️  EKSEKUSI SELESAI — ${total} record di-soft-delete.`);
    if (total > 0) {
      console.log('\n   ID record yang di-soft-delete:');
      (result.data?.soft_deleted_ids ?? []).forEach(id => {
        console.log(`   - ${id}`);
      });
    }
    console.log('\n✅ Selesai. Verifikasi dengan dry run:');
    if (studentNisn) {
      console.log(`   node scratch/spp-cleanup-dry-run.js ${studentNisn}`);
    } else {
      console.log(`   node scratch/spp-cleanup-dry-run.js`);
    }
  }
  console.log('═══════════════════════════════════════════════════════');
}

run().catch(err => {
  console.error('❌ Error tidak terduga:', err.message);
  process.exit(1);
});
