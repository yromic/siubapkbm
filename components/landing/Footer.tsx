"use client";

import React from "react";
import Link from "next/link";
import { Phone, Mail, Clock, MapPin, MessageSquare } from "lucide-react";

interface FooterProps {
  config?: {
    school_name: string;
    short_name: string;
    tagline: string;
    contact_phone_display: string;
    contact_phone_raw: string;
    contact_email: string;
    address_street: string;
    address_village: string;
    address_district: string;
    address_regency: string;
    address_postal_code: string;
    maps_embed_url?: string | null;
    social_media?: {
      instagram?: string;
      facebook?: string;
      youtube?: string;
      whatsapp?: string;
    };
  };
}

export default function Footer({ config }: FooterProps) {
  const schoolName = config?.school_name || "SIUBA (Paket A PKBM Baitusyukur Learning Center)";
  const shortName = config?.short_name || "SIUBA";
  const tagline = config?.tagline || "Sekolah Dasar Alternatif Pilihan Utama dengan kurikulum esensial bebas tekanan dan penanaman adab Islami berlandaskan sunnah.";
  const phoneDisplay = config?.contact_phone_display || "0896-5549-6283";
  const phoneRaw = config?.contact_phone_raw || "+6289655496283";
  const email = config?.contact_email || "pkbmpaketasiuba@gmail.com";
  
  const address = config
    ? `${config.address_street}, ${config.address_village}, Kec. ${config.address_district}, ${config.address_regency}, Jawa Tengah ${config.address_postal_code}`
    : "Jl. Letjend Suprapto, Putotan, Sidomulyo, Kec. Ungaran Timur., Kabupaten Semarang, Jawa Tengah 50514";

  const socialInstagram = config?.social_media?.instagram || "https://www.instagram.com/siuba_pkbmblc/";
  const socialFacebook = config?.social_media?.facebook || "https://facebook.com";
  const socialYoutube = config?.social_media?.youtube || "https://youtube.com";
  const socialWhatsapp = config?.social_media?.whatsapp || `https://wa.me/${phoneRaw.replace(/[^0-9]/g, "")}`;
  const mapsUrl = config?.maps_embed_url || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d556.3952127916491!2d110.40751058370243!3d-7.13766460793378!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e708974e800d0ef%3A0x990900a9c50b454e!2sPKBM%20Baitusyukur%20Learning%20Center!5e1!3m2!1sen!2sid!4v1783238781281!5m2!1sen!2sid";

  return (
    <footer id="kontak" className="w-full bg-zinc-900 text-zinc-300 pt-20 pb-10 border-t border-zinc-800">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-zinc-800">

        {/* Brand Column */}
        <div className="md:col-span-4 space-y-6">
          <Link href="#beranda" className="flex items-center gap-2">
            <span className="font-fredoka text-3xl font-bold bg-gradient-to-r from-brand-emerald-500 to-brand-lime-400 bg-clip-text text-transparent">
              {shortName}
            </span>
          </Link>
          <p className="font-plus-jakarta text-zinc-400 text-sm leading-relaxed">
            {tagline}
          </p>
          {/* Social Icons */}
          <div className="flex gap-4">
            <Link
              href={socialInstagram}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-850 hover:bg-brand-emerald-600 hover:text-white transition-colors"
              aria-label="SIUBA Instagram"
            >
              <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            </Link>
            <Link
              href={socialFacebook}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-850 hover:bg-brand-emerald-600 hover:text-white transition-colors"
              aria-label="SIUBA Facebook"
            >
              <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
            </Link>
            <Link
              href={socialYoutube}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-850 hover:bg-brand-emerald-600 hover:text-white transition-colors"
              aria-label="SIUBA YouTube"
            >
              <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
            </Link>
            <Link
              href={socialWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-850 hover:bg-brand-emerald-600 hover:text-white transition-colors"
              aria-label="SIUBA WhatsApp"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Contacts Info */}
        <div className="md:col-span-4 space-y-6">
          <h3 className="font-fredoka text-xl font-bold text-white">Hubungi Kami</h3>
          <ul className="space-y-4 font-plus-jakarta text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-brand-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{address}</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-brand-emerald-500 flex-shrink-0" />
              <span>{phoneDisplay}</span>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-brand-emerald-500 flex-shrink-0" />
              <span>{email}</span>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-brand-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Jam Operasional Kantor:</p>
                <p className="text-zinc-400 text-xs mt-0.5">Senin - Jumat: 07:00 - 15:30 WIB</p>
                <p className="text-zinc-400 text-xs">Sabtu & Minggu: Libur</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Google Maps Embed */}
        <div className="md:col-span-4 space-y-6">
          <h3 className="font-fredoka text-xl font-bold text-white">Lokasi Sekolah</h3>
          <div className="relative w-full aspect-16/10 bg-zinc-800 rounded-[20px] overflow-hidden border border-zinc-700/60">
            <iframe
              src={mapsUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Peta Lokasi SIUBA"
            ></iframe>
          </div>
        </div>

      </div>

      <div className="max-w-7xl mx-auto px-6 pt-10 text-center font-plus-jakarta text-xs text-zinc-500 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
          <span>&copy; {new Date().getFullYear()} {schoolName}. Hak Cipta Dilindungi.</span>
          <span className="hidden sm:inline text-zinc-700">|</span>
          <span className="text-zinc-550">
            Developed by <span className="font-semibold text-brand-emerald-500 hover:text-brand-emerald-400 transition-colors">IKDevworks</span>
          </span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="hover:text-white transition-colors">Portal Akademis</Link>
          <span>&middot;</span>
          <Link href="#tentang" className="hover:text-white transition-colors">Kebijakan Privasi</Link>
        </div>
      </div>
    </footer>
  );
}
