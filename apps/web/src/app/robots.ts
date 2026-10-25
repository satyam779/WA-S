import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api', '/reset-password'] },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
