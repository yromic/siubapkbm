import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { v4 as uuidv4 } from 'uuid';
import { getAssetById, Asset } from './assetService';

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
    if (row.logo_id) row.logo = await getAssetById(row.logo_id);
    if (row.favicon_id) row.favicon = await getAssetById(row.favicon_id);
    if (row.principal_photo_id) row.principal_photo = await getAssetById(row.principal_photo_id);
    
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
    const current = await getWebsiteConfig();
    const id = current.id;
    
    // Prep JSON columns
    const updateData: any = { ...data, updated_at: new Date() };
    if (data.social_media) updateData.social_media = JSON.stringify(data.social_media);
    if (data.seo_defaults) updateData.seo_defaults = JSON.stringify(data.seo_defaults);
    if (data.theme_branding) updateData.theme_branding = JSON.stringify(data.theme_branding);
    
    await db('website_config').where('id', id).update(updateData);
    
    return await getWebsiteConfig();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : 'Database error updating website configuration',
      'ERR_DATABASE',
      500
    );
  }
}
