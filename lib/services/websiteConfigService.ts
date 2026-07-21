import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { v4 as uuidv4 } from 'uuid';
import { getAssetById, Asset } from './assetService';
import { validateBrandingConfig, validateContactConfig, validateSEOConfig } from '@/lib/validators/websiteConfigValidator';
import { createAuditLog } from './auditService';

export interface WebsiteConfig {
  id: string;
  school_name: string;
  short_name: string;
  tagline: string;
  logo_id?: string | null;
  favicon_id?: string | null;
  principal_name: string;
  principal_title: string;
  principal_greeting: string;
  principal_photo_id?: string | null;
  contact_phone_raw: string;
  contact_phone_display: string;
  contact_email: string;
  address_street: string;
  address_village: string;
  address_district: string;
  address_regency: string;
  address_postal_code: string;
  maps_embed_url?: string | null;
  social_media: any; // JSON
  seo_defaults: any;  // JSON
  theme_branding: any; // JSON
  created_at?: Date;
  updated_at?: Date;
  
  // Joined fields
  logo?: Asset | null;
  favicon?: Asset | null;
  principal_photo?: Asset | null;
}

const DEFAULT_CONFIG: Omit<WebsiteConfig, 'id'> = {
  school_name: 'SIUBA (Paket A PKBM Baitusyukur Learning Center)',
  short_name: 'SIUBA',
  tagline: 'Sekolah Dasar Alternatif Pilihan Utama',
  logo_id: null,
  favicon_id: null,
  principal_name: 'Ustadz Pengelola',
  principal_title: 'Kepala PKBM Baitusyukur',
  principal_greeting: 'Pendidikan dasar kesetaraan (Paket A) berbasis adab Islami di bawah lingkungan belajar minimalis yang aman secara psikologis. Resmi dan diakui negara.',
  principal_photo_id: null,
  contact_phone_raw: '+6289655496283',
  contact_phone_display: '0896-5549-6283',
  contact_email: 'info@siuba.sch.id',
  address_street: 'Jl. Letjend Suprapto, Putotan, Sidomulyo',
  address_village: 'Sidomulyo',
  address_district: 'Ungaran Timur',
  address_regency: 'Kabupaten Semarang',
  address_postal_code: '50514',
  maps_embed_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3958.825838530364!2d110.4287848!3d-7.1461936!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e708170c1e84dfb%3A0xe54b9f2d1e089204!2sPKBM%20Baitusyukur!5e0!3m2!1sid!2sid!4v1721500000000!5m2!1sid!2sid',
  social_media: JSON.stringify({
    instagram: 'https://instagram.com/pkbm_baitusyukur',
    facebook: '',
    youtube: '',
    whatsapp: 'https://wa.me/6289655496283'
  }),
  seo_defaults: JSON.stringify({
    default_description: 'Pendidikan dasar kesetaraan (Paket A) berbasis adab Islami di bawah lingkungan belajar minimalis yang aman secara psikologis.',
    default_keywords: ['siuba', 'paket a', 'pkbm baitusyukur', 'sekolah alternatif', 'ungaran'],
    default_og_image: '/images/activities/activity-1.webp',
    canonical_base_url: 'https://siuba.sch.id',
    robots_rules: {
      allowRules: ['/'],
      disallowRules: ['/dashboard/', '/portal/', '/login', '/parent/dashboard/', '/parent/academic/', '/parent/character/', '/parent/spp/', '/api/']
    }
  }),
  theme_branding: JSON.stringify({
    primary_color: '#10b981',
    secondary_color: '#065f46',
    brand_font: 'plus-jakarta'
  })
};

export async function getWebsiteConfig(): Promise<WebsiteConfig> {
  try {
    let row = await db('website_config').first();
    
    // Auto-seed if empty
    if (!row) {
      const id = uuidv4();
      row = { id, ...DEFAULT_CONFIG };
      await db('website_config').insert(row);
    }
    
    // Parse JSON columns
    if (typeof row.social_media === 'string') row.social_media = JSON.parse(row.social_media);
    if (typeof row.seo_defaults === 'string') row.seo_defaults = JSON.parse(row.seo_defaults);
    if (typeof row.theme_branding === 'string') row.theme_branding = JSON.parse(row.theme_branding);
    
    // Resolve Assets
    if (row.logo_id) {
      try {
        const asset = await getAssetById(row.logo_id);
        row.logo = (asset && asset.url) ? asset : null;
      } catch (e) {
        console.error('Error resolving logo asset:', e);
        row.logo = null;
      }
    } else {
      row.logo = null;
    }

    if (row.favicon_id) {
      try {
        const asset = await getAssetById(row.favicon_id);
        row.favicon = (asset && asset.url) ? asset : null;
      } catch (e) {
        console.error('Error resolving favicon asset:', e);
        row.favicon = null;
      }
    } else {
      row.favicon = null;
    }

    if (row.principal_photo_id) {
      try {
        const asset = await getAssetById(row.principal_photo_id);
        row.principal_photo = (asset && asset.url) ? asset : null;
      } catch (e) {
        console.error('Error resolving principal photo asset:', e);
        row.principal_photo = null;
      }
    } else {
      row.principal_photo = null;
    }
    
    return row as WebsiteConfig;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : 'Database error retrieving website configuration',
      'ERR_DATABASE',
      500
    );
  }
}

export async function updateWebsiteConfig(data: Partial<Omit<WebsiteConfig, 'id' | 'created_at' | 'updated_at'>>): Promise<WebsiteConfig> {
  try {
    // Validate partial inputs
    validateBrandingConfig(data);
    validateContactConfig(data);
    validateSEOConfig(data);

    const current = await getWebsiteConfig();
    const id = current.id;
    
    // Prep JSON columns
    const updateData: any = { ...data, updated_at: new Date() };
    if (data.social_media) updateData.social_media = JSON.stringify(data.social_media);
    if (data.seo_defaults) updateData.seo_defaults = JSON.stringify(data.seo_defaults);
    if (data.theme_branding) updateData.theme_branding = JSON.stringify(data.theme_branding);
    
    await db('website_config').where('id', id).update(updateData);
    
    const updated = await getWebsiteConfig();
    
    // Create audit log for this update (serves as version snapshot)
    await createAuditLog({
      action: 'publish',
      entity_type: 'website_config',
      entity_id: id,
      old_value: current,
      new_value: updated,
      description: 'Mempublikasikan perubahan konfigurasi website.'
    });

    return updated;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating website configuration',
      'ERR_DATABASE',
      500
    );
  }
}

export interface BrandingConfig {
  school_name: string;
  short_name: string;
  tagline: string;
  logo_id?: string | null;
  favicon_id?: string | null;
  theme_branding: any;
  logo?: Asset | null;
  favicon?: Asset | null;
}

export interface ContactConfig {
  contact_phone_raw: string;
  contact_phone_display: string;
  contact_email: string;
  address_street: string;
  address_village: string;
  address_district: string;
  address_regency: string;
  address_postal_code: string;
  maps_embed_url?: string | null;
}

export interface SocialConfig {
  social_media: any;
}

export interface SEOConfig {
  seo_defaults: any;
}

export interface PrincipalConfig {
  principal_name: string;
  principal_title: string;
  principal_greeting: string;
  principal_photo_id?: string | null;
  principal_photo?: Asset | null;
}

export async function getBrandingConfig(): Promise<BrandingConfig> {
  const config = await getWebsiteConfig();
  return {
    school_name: config.school_name,
    short_name: config.short_name,
    tagline: config.tagline,
    logo_id: config.logo_id,
    favicon_id: config.favicon_id,
    theme_branding: config.theme_branding,
    logo: config.logo,
    favicon: config.favicon,
  };
}

export async function getContactConfig(): Promise<ContactConfig> {
  const config = await getWebsiteConfig();
  return {
    contact_phone_raw: config.contact_phone_raw,
    contact_phone_display: config.contact_phone_display,
    contact_email: config.contact_email,
    address_street: config.address_street,
    address_village: config.address_village,
    address_district: config.address_district,
    address_regency: config.address_regency,
    address_postal_code: config.address_postal_code,
    maps_embed_url: config.maps_embed_url,
  };
}

export async function getSocialConfig(): Promise<SocialConfig> {
  const config = await getWebsiteConfig();
  return {
    social_media: config.social_media,
  };
}

export async function getSEOConfig(): Promise<SEOConfig> {
  const config = await getWebsiteConfig();
  return {
    seo_defaults: config.seo_defaults,
  };
}

export async function getPrincipalConfig(): Promise<PrincipalConfig> {
  const config = await getWebsiteConfig();
  return {
    principal_name: config.principal_name,
    principal_title: config.principal_title,
    principal_greeting: config.principal_greeting,
    principal_photo_id: config.principal_photo_id,
    principal_photo: config.principal_photo,
  };
}

export async function updateBrandingConfig(data: Partial<BrandingConfig>): Promise<BrandingConfig> {
  validateBrandingConfig(data);
  const updated = await updateWebsiteConfig(data);
  return {
    school_name: updated.school_name,
    short_name: updated.short_name,
    tagline: updated.tagline,
    logo_id: updated.logo_id,
    favicon_id: updated.favicon_id,
    theme_branding: updated.theme_branding,
    logo: updated.logo,
    favicon: updated.favicon,
  };
}

export async function updateContactConfig(data: Partial<ContactConfig>): Promise<ContactConfig> {
  validateContactConfig(data);
  const updated = await updateWebsiteConfig(data);
  return {
    contact_phone_raw: updated.contact_phone_raw,
    contact_phone_display: updated.contact_phone_display,
    contact_email: updated.contact_email,
    address_street: updated.address_street,
    address_village: updated.address_village,
    address_district: updated.address_district,
    address_regency: updated.address_regency,
    address_postal_code: updated.address_postal_code,
    maps_embed_url: updated.maps_embed_url,
  };
}

export async function updateSEOConfig(data: Partial<SEOConfig>): Promise<SEOConfig> {
  validateSEOConfig(data);
  const updated = await updateWebsiteConfig(data);
  return {
    seo_defaults: updated.seo_defaults,
  };
}

export async function getWebsiteConfigHistory(): Promise<any[]> {
  try {
    const logs = await db('audit_logs')
      .where('entity_type', 'website_config')
      .orderBy('created_at', 'desc');
    return logs.map((log: any) => {
      if (typeof log.new_value === 'string') log.new_value = JSON.parse(log.new_value);
      if (typeof log.old_value === 'string') log.old_value = JSON.parse(log.old_value);
      return log;
    });
  } catch (error) {
    throw new AppError('Gagal mengambil riwayat konfigurasi.', 'ERR_DATABASE', 500);
  }
}

export async function rollbackWebsiteConfig(auditLogId: string): Promise<WebsiteConfig> {
  try {
    const log = await db('audit_logs').where('id', auditLogId).first();
    if (!log) {
      throw new AppError('Versi riwayat tidak ditemukan.', 'ERR_NOT_FOUND', 404);
    }
    
    const snapshot = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value;
    if (!snapshot) {
      throw new AppError('Snapshot kosong atau tidak valid.', 'ERR_VALIDATION', 400);
    }
    
    // Delete joined metadata fields to restore cleanly
    const { id, created_at, updated_at, logo, favicon, principal_photo, ...cleanSnapshot } = snapshot;
    
    return await updateWebsiteConfig(cleanSnapshot);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Gagal melakukan rollback konfigurasi.',
      'ERR_DATABASE',
      500
    );
  }
}
