import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/signup', '/login', '/privacy', '/terms', '/refunds'].map((path) => ({ url: `${SITE.url}${path}` }));
}
