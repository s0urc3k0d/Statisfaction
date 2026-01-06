import './globals.css';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../components/ThemeProvider';
import { ToastProvider } from '../components/Toast';
import { EventsListener } from '../components/Events';
import { ReconsentBanner } from '../components/ReconsentBanner';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ConsentBanner } from '../components/ConsentBanner';
import { AdsenseInit } from '../components/AdsenseInit';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://statisfaction.ovh';
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-7283351114219521';
const SITE_NAME = 'Statisfaction';
const GITHUB = 'https://github.com/s0urc3k0d';
const TWITCH = 'https://twitch.tv/lantredesilver';
const CLAIM = 'Stats & Outils avancés Twitch: calendrier de live, clips, analytics détaillées. Optimisez votre stream.';
const SOCIALS = [
  'https://twitter.com/lantredesilver',
  'https://instagram.com/lantredesilver',
  'https://www.tiktok.com/@lantredesilver',
  'https://youtube.com/@lantredesilver',
  TWITCH,
  GITHUB,
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: CLAIM,
  alternates: {
    canonical: SITE_URL,
  },
  applicationName: SITE_NAME,
  keywords: ['Twitch', 'analytics', 'statistiques', 'stream', 'viewers', 'followers', 'heatmap', 'dashboard', 'FR'],
  authors: [{ name: 'S0URC3K0D', url: GITHUB }],
  creator: 'S0URC3K0D',
  publisher: 'S0URC3K0D',
  category: 'technology',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_NAME,
    description: CLAIM,
  },
  twitter: {
    card: 'summary_large_image',
    site: '@lantredesilver',
    creator: '@lantredesilver',
    title: SITE_NAME,
    description: CLAIM,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  manifest: '/site.webmanifest',
  other: {
    'google-adsense-account': ADSENSE_CLIENT,
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0f14',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ThemeProvider>
          <ToastProvider>
            <EventsListener />
            <ReconsentBanner />
            <ConsentBanner />
            <AdsenseInit />
            <Script id="ldjson-website" type="application/ld+json" strategy="afterInteractive"
              dangerouslySetInnerHTML={{ __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: SITE_NAME,
                url: SITE_URL,
                inLanguage: 'fr-FR',
                publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
              }) }}
            />
            <Script id="ldjson-organization" type="application/ld+json" strategy="afterInteractive"
              dangerouslySetInnerHTML={{ __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: SITE_NAME,
                url: SITE_URL,
                sameAs: SOCIALS,
              }) }}
            />
            <Script id="ldjson-person" type="application/ld+json" strategy="afterInteractive"
              dangerouslySetInnerHTML={{ __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Person',
                name: 'S0URC3K0D',
                url: GITHUB,
                sameAs: SOCIALS,
              }) }}
            />
            {children}
            <footer className="mt-16 py-6 text-sm" style={{ borderTop: '1px solid var(--border)', color: 'color-mix(in srgb, var(--text) 70%, transparent)' }}>
              <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>© {new Date().getFullYear()} Statisfaction</div>
                <nav className="flex flex-wrap gap-4 justify-center">
                  <a className="hover:underline hover:text-[var(--brand)]" href="/features">Fonctionnalités</a>
                  <a className="hover:underline hover:text-[var(--brand)]" href="/guide">Guide</a>
                  <a className="hover:underline hover:text-[var(--brand)]" href="/about">À propos</a>
                  <a className="hover:underline hover:text-[var(--brand)]" href="/privacy">Confidentialité</a>
                </nav>
              </div>
            </footer>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
