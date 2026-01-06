"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      const ok = localStorage.getItem('consent_ads') === '1';
      setVisible(!ok);
    } catch {}
  }, []);
  const accept = () => {
    try {
      localStorage.setItem('consent_ads', '1');
      window.dispatchEvent(new Event('ads-consent'));
      setVisible(false);
    } catch {}
  };
  const later = () => setVisible(false);
  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92%] rounded shadow-lg p-4" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 92%, transparent)', border: '1px solid var(--border)' }}>
      <div className="text-sm" style={{ color: 'var(--text)' }}>
        Nous utilisons des cookies pour afficher des publicités (AdSense) afin de soutenir le service. 
  Vous pouvez consulter notre <Link href="/privacy" className="hover:underline" style={{ color: 'var(--brand)' }}>politique de confidentialité</Link>.
      </div>
      <div className="mt-3 flex gap-2 justify-end">
  <button onClick={later} className="btn btn-muted">Plus tard</button>
  <button onClick={accept} className="btn btn-brand">Accepter</button>
      </div>
    </div>
  );
}
