import { AppError } from '@/lib/errors';
import { BrandingConfig, ContactConfig, SEOConfig } from '@/lib/services/websiteConfigService';

function validateRequired(obj: any, fields: string[]) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || String(obj[field]).trim() === '') {
      throw new AppError(`Field '${field}' wajib diisi.`, 'ERR_VALIDATION', 400);
    }
  }
}

export function validateBrandingConfig(data: Partial<BrandingConfig>): void {
  if (data.school_name !== undefined) {
    validateRequired(data, ['school_name']);
  }
  if (data.short_name !== undefined) {
    validateRequired(data, ['short_name']);
  }
  if (data.tagline !== undefined) {
    validateRequired(data, ['tagline']);
  }

  if (data.theme_branding) {
    const { primary_color, secondary_color } = data.theme_branding;
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (primary_color && !hexPattern.test(primary_color)) {
      throw new AppError('Warna Utama harus berupa kode hex color valid (contoh: #10b981).', 'ERR_VALIDATION', 400);
    }
    if (secondary_color && !hexPattern.test(secondary_color)) {
      throw new AppError('Warna Sekunder harus berupa kode hex color valid (contoh: #065f46).', 'ERR_VALIDATION', 400);
    }
  }
}

export function validateContactConfig(data: Partial<ContactConfig>): void {
  const fieldsToCheck = [
    'contact_phone_raw', 'contact_phone_display', 'contact_email',
    'address_street', 'address_village', 'address_district',
    'address_regency', 'address_postal_code'
  ];
  
  for (const field of fieldsToCheck) {
    if (data[field as keyof ContactConfig] !== undefined) {
      if (data[field as keyof ContactConfig] === null || String(data[field as keyof ContactConfig]).trim() === '') {
        throw new AppError(`Field '${field}' wajib diisi.`, 'ERR_VALIDATION', 400);
      }
    }
  }

  if (data.contact_email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(data.contact_email)) {
      throw new AppError('Email resmi tidak valid.', 'ERR_VALIDATION', 400);
    }
  }
}

export function validateSEOConfig(data: Partial<SEOConfig>): void {
  if (data.seo_defaults) {
    const { canonical_base_url, default_description } = data.seo_defaults;
    
    if (canonical_base_url) {
      const urlPattern = /^https?:\/\/[^\s$.?#].[^\s]*$/i;
      if (!urlPattern.test(canonical_base_url)) {
        throw new AppError('Canonical Base URL harus berupa alamat web (URL) valid yang diawali http:// atau https://.', 'ERR_VALIDATION', 400);
      }
    }
    
    if (default_description && default_description.length > 300) {
      throw new AppError('Deskripsi SEO default tidak boleh melebihi 300 karakter.', 'ERR_VALIDATION', 400);
    }
  }
}
