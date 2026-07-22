"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  ResponsiveContainer,
  LoadingState,
  ForbiddenState,
} from "@/components/ui-states";
import { DatePicker } from "@/components/ui/date-picker";
import { humanizeError } from "@/lib/utils/ui-error";
import {
  getStudentDetail,
  updateStudent,
  StudentRecord,
  STUDENT_STATUSES,
  StudentStatus,
} from "@/lib/api/students";
import { validateNisn } from "@/lib/validation/student";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  hint,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  hint?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}) {
  return (
    <div>
      <FieldLabel>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432] focus:bg-white dark:focus:bg-zinc-900"
      />
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3.5 py-2.5 rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-[#468432]/30 focus:border-[#468432] focus:bg-white dark:focus:bg-zinc-900"
      >
        <option value="">Pilih...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function validateNik(label: string, value: string) {
  const normalized = onlyDigits(value);
  if (normalized && !/^\d{16}$/.test(normalized)) {
    return `${label} harus 16 digit angka.`;
  }
  return null;
}

export default function StudentEditPage() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Personal
  const [fullName, setFullName] = useState("");
  const [nisn, setNisn] = useState("");
  const [nik, setNik] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [religion, setReligion] = useState("");
  const [phone, setPhone] = useState("");
  const [affirmation, setAffirmation] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState("");
  const [status, setStatus] = useState<StudentStatus>("Aktif");

  // Family
  const [familyCardNumber, setFamilyCardNumber] = useState("");
  const [familyCardDate, setFamilyCardDate] = useState("");
  const [motherName, setMotherName] = useState("");
  const [motherNik, setMotherNik] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [fatherNik, setFatherNik] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianNik, setGuardianNik] = useState("");

  // Address
  const [addressStreet, setAddressStreet] = useState("");
  const [rt, setRt] = useState("");
  const [rw, setRw] = useState("");
  const [hamlet, setHamlet] = useState("");
  const [village, setVillage] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [sppAmount, setSppAmount] = useState("");

  const loadStudent = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const s = (await getStudentDetail(id, token)) as StudentRecord;
      setFullName(s.full_name || "");
      setNisn(s.nisn ? String(s.nisn) : "");
      setNik(s.nik ? String(s.nik) : "");
      setBirthPlace(s.birth_place || "");
      setBirthDate(s.birth_date ? s.birth_date.split("T")[0] : "");
      setGender(s.gender || "");
      setReligion(s.religion || "");
      setPhone(s.phone ? String(s.phone) : "");
      setAffirmation(s.affirmation || "");
      setSpecialNeeds(s.special_needs || "");
      setStatus(s.status || "Aktif");
      setFamilyCardNumber(s.family_card_number ? String(s.family_card_number) : "");
      setFamilyCardDate(s.family_card_date ? s.family_card_date.split("T")[0] : "");
      setMotherName(s.mother_name || "");
      setMotherNik(s.mother_nik ? String(s.mother_nik) : "");
      setFatherName(s.father_name || "");
      setFatherNik(s.father_nik ? String(s.father_nik) : "");
      setGuardianName(s.guardian_name || "");
      setGuardianNik(s.guardian_nik ? String(s.guardian_nik) : "");
      setAddressStreet(s.address_street || "");
      setRt(s.rt ? String(s.rt) : "");
      setRw(s.rw ? String(s.rw) : "");
      setHamlet(s.hamlet || "");
      setVillage(s.village || "");
      setDistrict(s.district || "");
      setCity(s.city || "");
      setProvince(s.province || "");
      setSppAmount(s.spp_amount !== undefined && s.spp_amount !== null ? String(s.spp_amount) : "");
    } catch (err: unknown) {
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    setTimeout(() => loadStudent(), 0);
  }, [loadStudent]);

  if (!user || (user.role !== "administrator" && user.role !== "admin")) {
    return (
      <ForbiddenState message="Halaman ini hanya dapat diakses oleh Administrator dan Operator." />
    );
  }

  if (loading) return <LoadingState message="Memuat data siswa..." />;

  if (error) {
    return (
      <ResponsiveContainer>
        <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 text-sm text-red-600">
          {error}
        </div>
      </ResponsiveContainer>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) { setError("Nama lengkap wajib diisi."); return; }
    const nisnError = validateNisn(nisn);
    if (nisnError) {
      setError(nisnError); return;
    }
    if (!birthDate) { setError("Tanggal lahir wajib diisi."); return; }
    if (!gender) { setError("Jenis kelamin wajib dipilih."); return; }
    const nikError =
      validateNik("NIK", nik) ||
      validateNik("NIK Ibu", motherNik) ||
      validateNik("NIK Ayah", fatherNik) ||
      validateNik("NIK Wali", guardianNik);
    if (nikError) {
      setError(nikError); return;
    }

    if (!token) return;
    setSaving(true);
    try {
      await updateStudent(id, {
        full_name: fullName.trim(),
        nisn: nisn.trim(),
        nik: onlyDigits(nik) || undefined,
        birth_place: birthPlace.trim() || undefined,
        birth_date: birthDate,
        gender: gender as "L" | "P",
        religion: religion || undefined,
        phone: phone.trim() || undefined,
        affirmation: affirmation.trim() || undefined,
        special_needs: specialNeeds.trim() || undefined,
        status,
        family_card_number: familyCardNumber.trim() || undefined,
        family_card_date: familyCardDate || undefined,
        mother_name: motherName.trim() || undefined,
        mother_nik: onlyDigits(motherNik) || undefined,
        father_name: fatherName.trim() || undefined,
        father_nik: onlyDigits(fatherNik) || undefined,
        guardian_name: guardianName.trim() || undefined,
        guardian_nik: onlyDigits(guardianNik) || undefined,
        address_street: addressStreet.trim() || undefined,
        rt: rt.trim() || undefined,
        rw: rw.trim() || undefined,
        hamlet: hamlet.trim() || undefined,
        village: village.trim() || undefined,
        district: district.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        spp_amount: sppAmount ? parseFloat(sppAmount) : undefined,
      }, token);
      router.push(`/students/${id}`);
    } catch (err: unknown) {
      setError(humanizeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveContainer className="space-y-6 pb-10">
      <PageHeader
        title="Edit Data Siswa"
        description="Ubah data siswa. Field bertanda * wajib diisi. PIN diubah di tab PIN pada halaman detail."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard title="Data Pribadi">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <TextInput label="Nama Lengkap" value={fullName} onChange={setFullName} required />
            </div>
            <TextInput label="NISN" value={nisn} onChange={setNisn} required hint="8–12 digit angka" />
            <TextInput label="NIK" value={nik} onChange={(v) => setNik(onlyDigits(v))} hint="16 digit angka" inputMode="numeric" maxLength={16} />
            <TextInput label="Tempat Lahir" value={birthPlace} onChange={setBirthPlace} />
            <DatePicker label="Tanggal Lahir *" value={birthDate} onChange={setBirthDate} placeholder="Pilih tanggal lahir..." required />
            <SelectInput label="Jenis Kelamin" value={gender} onChange={setGender} required
              options={[{ value: "L", label: "Laki-laki" }, { value: "P", label: "Perempuan" }]} />
            <SelectInput label="Agama" value={religion} onChange={setReligion}
              options={["Islam","Kristen","Katolik","Hindu","Buddha","Konghucu"].map(r => ({ value: r, label: r }))} />
            <TextInput label="No. Telepon" value={phone} onChange={setPhone} />
            <TextInput label="Afirmasi" value={affirmation} onChange={setAffirmation} />
            <TextInput label="Kebutuhan Khusus" value={specialNeeds} onChange={setSpecialNeeds} />
            <SelectInput label="Status Siswa" value={status} onChange={v => setStatus(v as StudentStatus)} required
              options={STUDENT_STATUSES.map(s => ({ value: s, label: s }))} />
            <TextInput label="Nominal SPP Bulanan (IDR)" value={sppAmount} onChange={setSppAmount} type="number" hint="Kosongkan jika menggunakan default sistem" />
          </div>
        </SectionCard>

        <SectionCard title="Data Keluarga">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label="No. Kartu Keluarga" value={familyCardNumber} onChange={setFamilyCardNumber} />
            <DatePicker label="Tgl. Kartu Keluarga" value={familyCardDate} onChange={setFamilyCardDate} placeholder="Pilih tanggal KK..." />
            <TextInput label="Nama Ibu Kandung" value={motherName} onChange={setMotherName} />
            <TextInput label="NIK Ibu" value={motherNik} onChange={(v) => setMotherNik(onlyDigits(v))} hint="16 digit" inputMode="numeric" maxLength={16} />
            <TextInput label="Nama Ayah" value={fatherName} onChange={setFatherName} />
            <TextInput label="NIK Ayah" value={fatherNik} onChange={(v) => setFatherNik(onlyDigits(v))} hint="16 digit" inputMode="numeric" maxLength={16} />
            <TextInput label="Nama Wali" value={guardianName} onChange={setGuardianName} />
            <TextInput label="NIK Wali" value={guardianNik} onChange={(v) => setGuardianNik(onlyDigits(v))} hint="16 digit" inputMode="numeric" maxLength={16} />
          </div>
        </SectionCard>

        <SectionCard title="Alamat">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <TextInput label="Alamat Jalan" value={addressStreet} onChange={setAddressStreet} />
            </div>
            <TextInput label="RT" value={rt} onChange={setRt} />
            <TextInput label="RW" value={rw} onChange={setRw} />
            <TextInput label="Dusun / Padukuhan" value={hamlet} onChange={setHamlet} />
            <TextInput label="Desa / Kelurahan" value={village} onChange={setVillage} />
            <TextInput label="Kecamatan" value={district} onChange={setDistrict} />
            <TextInput label="Kab. / Kota" value={city} onChange={setCity} />
            <div className="sm:col-span-2">
              <TextInput label="Provinsi" value={province} onChange={setProvince} />
            </div>
          </div>
        </SectionCard>

        <div className="p-4 rounded-[20px] bg-zinc-50 dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          Untuk mereset PIN Akses Orang Tua, kembali ke halaman Detail Siswa → tab <strong>PIN Orang Tua</strong>.
        </div>

        {error && (
          <div className="p-4 rounded-[20px] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/students/${id}`)}
            disabled={saving}
            className="px-5 py-2.5 rounded-[12px] text-sm font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-[12px] text-sm font-semibold bg-[#468432] hover:bg-[#3A6F2B] text-white shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2 min-w-[120px] justify-center"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Simpan Perubahan"
            )}
          </button>
        </div>
      </form>
    </ResponsiveContainer>
  );
}
