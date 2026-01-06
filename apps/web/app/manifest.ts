import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://statisfaction.sourcekod.fr';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Statisfaction',
    short_name: 'Statisfaction',
    description: 'Dashboard analytique pour streamers Twitch (FR) — heatmaps, recap email, clips & outils streamer.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b0f14',
    theme_color: '#0b0f14',
    icons: [
      { src: '/favicon.ico', sizes: '32x32 48x48 64x64', type: 'image/x-icon' },
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
