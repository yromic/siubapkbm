import { MetadataRoute } from 'next';
import { getWebsiteConfig } from '@/lib/services/websiteConfigService';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  try {
    const config = await getWebsiteConfig();
    return {
      name: config.school_name,
      short_name: config.short_name,
      description: config.tagline,
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: config.theme_branding?.primary_color || '#10b981',
      lang: 'id',
      dir: 'ltr',
      prefer_related_applications: false,
      icons: [
        {
          src: config.favicon?.url || '/favicon.ico',
          sizes: 'any',
          type: 'image/x-icon',
        },
      ],
    };
  } catch (error) {
    return {
      name: 'SIUBA PKBM Baitusyukur',
      short_name: 'SIUBA',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#10b981',
      lang: 'id',
      dir: 'ltr',
    };
  }
}

