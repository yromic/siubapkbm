# Official School Letterhead (Kop Surat Resmi)

Letakkan file kop resmi sekolah berformat PNG di folder ini dengan nama:
`school-letterhead.png`

Spesifikasi asset yang ideal:
- Format: PNG transparan atau latar putih bersih
- Crop: Bagian kop/header saja (bukan 1 halaman penuh A4)
- Dimensi proporsional (aspect ratio horizontal ~5:1 hingga ~8:1, lebar minimal 1200px agar tajam saat dicetak)

Komponen `<OfficialSchoolLetterhead />` akan otomatis memuat file ini pada seluruh cetakan RPM, KKTP, dan Raport Trisula. Jika file belum tersedia, sistem secara otomatis beralih ke kop teks resmi berstandar PKBM BLC.
