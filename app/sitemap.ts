import { MetadataRoute } from 'next';
import { getWebsiteConfig } from '@/lib/services/websiteConfigService';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const config = await getWebsiteConfig();
    const canonical = config.seo_defaults?.canonical_base_url || 'https://siuba.sch.id';
    const baseUrl = canonical.replace(/\/$/, '') + '/';
    
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 1,
      },
    ];
  } catch (error) {
    return [
      {
        url: 'https://siuba.sch.id/',
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 1,
      },
    ];
  }
}
