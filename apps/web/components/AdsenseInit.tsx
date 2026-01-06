"use client";
import Script from 'next/script';
import { useEffect, useState } from 'react';

export function AdsenseInit() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const read = () => {
      try { setConsented(typeof window !== 'undefined' && localStorage.getItem('consent_ads') === '1'); } catch {}
    };
    read();
    const onConsent = () => read();
    window.addEventListener('ads-consent', onConsent);
    window.addEventListener('storage', onConsent);
    return () => {
      window.removeEventListener('ads-consent', onConsent);
      window.removeEventListener('storage', onConsent);
    };
  }, []);

  if (!client || !consented) return null;
  return (
    <Script
      id="adsbygoogle-lib"
      async
      crossOrigin="anonymous"
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
    />
  );
}
