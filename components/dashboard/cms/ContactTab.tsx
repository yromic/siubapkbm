"use client";

import React, { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";

interface WebsiteConfig {
  contact_phone_raw: string;
  contact_phone_display: string;
  contact_email: string;
  address_street: string;
  address_village: string;
  address_district: string;
  address_regency: string;
  address_postal_code: string;
  maps_embed_url?: string | null;
  social_media: any;
}

interface ContactTabProps {
  config: WebsiteConfig;
  onUpdate: (data: Partial<WebsiteConfig>) => Promise<void>;
  setIsDirty?: (dirty: boolean) => void;
}

export default function ContactTab({ config, onUpdate, setIsDirty }: ContactTabProps) {
  const [phoneRaw, setPhoneRaw] = useState(config.contact_phone_raw || "");
  const [phoneDisplay, setPhoneDisplay] = useState(config.contact_phone_display || "");
  const [email, setEmail] = useState(config.contact_email || "");
  
  // Address
  const [street, setStreet] = useState(config.address_street || "");
  const [village, setVillage] = useState(config.address_village || "");
  const [district, setDistrict] = useState(config.address_district || "");
  const [regency, setRegency] = useState(config.address_regency || "");
  const [postalCode, setPostalCode] = useState(config.address_postal_code || "");
  const [mapsUrl, setMapsUrl] = useState(config.maps_embed_url || "");

  // Social Media
  const sm = config.social_media || {};
  const [instagram, setInstagram] = useState(sm.instagram || "");
  const [facebook, setFacebook] = useState(sm.facebook || "");
  const [youtube, setYoutube] = useState(sm.youtube || "");
  const [whatsapp, setWhatsapp] = useState(sm.whatsapp || "");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const isPhoneRawChanged = phoneRaw !== (config.contact_phone_raw || "");
    const isPhoneDisplayChanged = phoneDisplay !== (config.contact_phone_display || "");
    const isEmailChanged = email !== (config.contact_email || "");
    const isStreetChanged = street !== (config.address_street || "");
    const isVillageChanged = village !== (config.address_village || "");
    const isDistrictChanged = district !== (config.address_district || "");
    const isRegencyChanged = regency !== (config.address_regency || "");
    const isPostalChanged = postalCode !== (config.address_postal_code || "");
    const isMapsChanged = mapsUrl !== (config.maps_embed_url || "");
    
    const sm = config.social_media || {};
    const isInstaChanged = instagram !== (sm.instagram || "");
    const isFbChanged = facebook !== (sm.facebook || "");
    const isYtChanged = youtube !== (sm.youtube || "");
    const isWaChanged = whatsapp !== (sm.whatsapp || "");

    const dirty = isPhoneRawChanged || isPhoneDisplayChanged || isEmailChanged || isStreetChanged || isVillageChanged || isDistrictChanged || isRegencyChanged || isPostalChanged || isMapsChanged || isInstaChanged || isFbChanged || isYtChanged || isWaChanged;

    if (setIsDirty) {
      setIsDirty(dirty);
    }
  }, [phoneRaw, phoneDisplay, email, street, village, district, regency, postalCode, mapsUrl, instagram, facebook, youtube, whatsapp, config, setIsDirty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdate({
        contact_phone_raw: phoneRaw,
        contact_phone_display: phoneDisplay,
        contact_email: email,
        address_street: street,
        address_village: village,
        address_district: district,
        address_regency: regency,
        address_postal_code: postalCode,
        maps_embed_url: mapsUrl || null,
        social_media: {
          instagram,
          facebook,
          youtube,
          whatsapp,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Contact Coordinates */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider mb-2">
              Kontak Hubung Resmi
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-450 mb-1.5">
                  Nomor Telepon Dialer (WhatsApp/Raw) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phoneRaw}
                  onChange={(e) => setPhoneRaw(e.target.value)}
                  placeholder="Contoh: +6289655496283"
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Nomor Telepon Display <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={phoneDisplay}
                  onChange={(e) => setPhoneDisplay(e.target.value)}
                  placeholder="Contoh: 0896-5549-6283"
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Email Resmi Sekolah <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Contoh: info@siuba.sch.id"
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Social Media Links */}
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider mb-2">
              Saluran Sosial Media
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  WhatsApp Link
                </label>
                <input
                  type="url"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Contoh: https://wa.me/6289655496283"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Instagram Link
                </label>
                <input
                  type="url"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="Contoh: https://instagram.com/nama_sekolah"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Facebook Link
                </label>
                <input
                  type="url"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="Contoh: https://facebook.com/halaman_sekolah"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  YouTube Channel Link
                </label>
                <input
                  type="url"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  placeholder="Contoh: https://youtube.com/c/channel_sekolah"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Address Coordinates */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#171717] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 uppercase tracking-wider mb-2">
              Koordinat Alamat & Lokasi
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Nama Jalan & No. Rumah <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                    Kelurahan / Desa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                    Kecamatan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                    Kota / Kabupaten <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regency}
                    onChange={(e) => setRegency(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                    Kode Pos <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-455 mb-1.5">
                  Google Maps Embed URL
                </label>
                <textarea
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  placeholder="Isi dengan iframe src URL dari Google Maps Share Embed..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-[#262626] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-zinc-100 resize-none font-mono text-[11px]"
                />
              </div>

              {mapsUrl && mapsUrl.startsWith("http") && (
                <div className="aspect-video w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50">
                  <iframe
                    title="Google Maps Preview"
                    src={mapsUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen={false}
                    loading="lazy"
                  ></iframe>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-zinc-950 hover:bg-zinc-850 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          Simpan Semua Perubahan
        </button>
      </div>
    </form>
  );
}
