import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://statisfaction.ovh';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/tools',
          '/history',
          '/recap',
          '/admin',
          '/auth',
          '/api',
          '/home',
          '/compare',
          '/raid',
          '/giveaway',
          '/goals',
          '/notifications',
        ],
      },
    ],
    sitemap: `${SITE_URL.replace(/\/$/, '')}/sitemap.xml`,
    host: SITE_URL.replace(/\/$/, ''),
  };
}
