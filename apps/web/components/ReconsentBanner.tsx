"use client";
import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';

// Bannière non bloquante si on détecte un manque de scope clips:edit via signal localStorage
export function ReconsentBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      const flag = localStorage.getItem('needClipsEditScope');
      setVisible(flag === '1');
    } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'needClipsEditScope') {
        setVisible(e.newValue === '1');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  if (!visible) return null;
  const goRescope = () => {
    try { localStorage.removeItem('needClipsEditScope'); } catch {}
    window.location.href = `${API_BASE}/auth/twitch/rescope?redirect=${encodeURIComponent('/dashboard')}`;
  };
  const dismiss = () => {
    try { localStorage.setItem('needClipsEditScope', '0'); } catch {}
    setVisible(false);
  };
  return (
    <div className="sticky top-0 z-50 bg-amber-900/50 border-b border-amber-700 text-amber-200">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
        <span className="text-sm">Autorisez l’accès “clips:edit” pour créer des clips depuis Statisfaction.</span>
        <button onClick={goRescope} className="text-sm px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded">Donner l’accès</button>
        <button onClick={dismiss} className="ml-auto text-sm opacity-80 hover:opacity-100">Ignorer</button>
      </div>
    </div>
  );
}
