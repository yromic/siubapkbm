import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/portal/', '/login', '/parent/dashboard/', '/parent/academic/', '/parent/character/', '/parent/spp/', '/api/'],
    },
    sitemap: 'https://siuba.sch.id/sitemap.xml',
  };
}
