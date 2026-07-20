import { MetadataRoute } from 'next';
import { getWebsiteConfig } from '@/lib/services/websiteConfigService';

export default async function robots(): Promise<MetadataRoute.Robots> {
  try {
    const config = await getWebsiteConfig();
    const canonical = config.seo_defaults?.canonical_base_url || 'https://siuba.sch.id';
    const rules = config.seo_defaults?.robots_rules || {
      allowRules: ['/'],
      disallowRules: ['/dashboard/', '/portal/', '/login', '/parent/dashboard/', '/parent/academic/', '/parent/character/', '/parent/spp/', '/api/']
    };
    
    return {
      rules: {
        userAgent: '*',
        allow: rules.allowRules || '/',
        disallow: rules.disallowRules || [],
      },
      sitemap: `${canonical.replace(/\/$/, '')}/sitemap.xml`,
    };
  } catch (error) {
    return {
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/portal/', '/login', '/parent/dashboard/', '/parent/academic/', '/parent/character/', '/parent/spp/', '/api/'],
      },
      sitemap: 'https://siuba.sch.id/sitemap.xml',
    };
  }
}
