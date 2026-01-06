"use client";
import { useEffect } from 'react';
import { API_BASE } from '../lib/api';
import { useToast } from './Toast';

export function EventsListener() {
  const { show } = useToast();
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/events`, { withCredentials: true });
    const onClip = (ev: MessageEvent) => {
      try {
        const d = JSON.parse(ev.data);
        const t = new Date(d.at).toLocaleTimeString();
        const createClip = async () => {
          try {
            const r = await fetch(`${API_BASE}/api/streams/${d.streamId}/clips`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
            if (!r.ok) throw new Error(String(r.status));
            const j = await r.json();
            if (!j?.ok) {
              // Activer bannière non bloquante
              try { localStorage.setItem('needClipsEditScope', '1'); } catch {}
              show('Autorisation clips:edit requise pour créer un clip.', 'warning');
              return;
            }
            // Succès: afficher un toast avec lien d’édition
            const link = j?.edit_url as string | undefined;
            if (link) {
              show('Clip créé. Vous pouvez l’éditer maintenant.', 'success', 8000, { label: 'Ouvrir', onClick: () => window.open(link, '_blank') });
            } else {
              show('Clip créé.', 'success');
            }
          } catch (e: any) {
            const msg = String(e?.message || '');
            if (msg.includes('401') || msg.includes('403')) {
              try { localStorage.setItem('needClipsEditScope', '1'); } catch {}
              show('Autorisation clips:edit requise pour créer un clip.', 'warning');
            }
          }
        };
        show(`Moment à clipper (${t}) • ${d.label || 'Spike viewers'} • score ${d.score}`, 'info', 8000, { label: 'Créer un clip', onClick: createClip });
      } catch {}
    };
    es.addEventListener('clip.suggested', onClip);
    return () => { es.removeEventListener('clip.suggested', onClip); es.close(); };
  }, [show]);
  return null;
}
