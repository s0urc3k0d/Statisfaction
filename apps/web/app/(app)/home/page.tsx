"use client";
import Link from 'next/link';
import useSWR from 'swr';
import { API_BASE, fetchJSON, SessionResponse, LastStreamResponse, TwitchStreamResponse, ScheduleEntry } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import { useState } from 'react';
import { Adsense } from '../../../components/Adsense';

export default function AppHome() {
  const { data: session } = useSWR<SessionResponse>(`${API_BASE}/auth/session`, fetchJSON);
  const isAdmin = !!session?.user?.isAdmin;
  const display = session?.user?.displayName || session?.user?.login || 'là';
  const { data: live } = useSWR<TwitchStreamResponse>(session?.authenticated ? `${API_BASE}/api/twitch/stream` : null, fetchJSON, { refreshInterval: 15000 });
  const liveData = (live?.data && live.data[0]) || null;
  const { data: recap } = useSWR<LastStreamResponse>(session?.authenticated ? `${API_BASE}/api/twitch/last-stream` : null, fetchJSON);
  const { show } = useToast();
  const [sending, setSending] = useState(false);
  const { data: schedule } = useSWR<ScheduleEntry[]>(session?.authenticated ? `${API_BASE}/api/schedule` : null, fetchJSON);
  const nextSlot = (schedule || []).map(s => ({ ...s, t: new Date(s.start).getTime() })).filter(s => s.t > Date.now()).sort((a,b)=>a.t-b.t)[0];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bienvenue{display ? `, ${display}` : ''}</h1>
      {/* Publicité en haut de page */}
      <div>
        <Adsense format="auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Tile href="/dashboard" title="Dashboard" desc="Vue d’ensemble en direct et récap." />
        <Tile href="/history" title="Historique" desc="Vos streams passés et stats." />
        <Tile href="/tools" title="Outils" desc="Clips, planning, raids, etc." />
        <Tile href="/recap" title="Récap" desc="Consulter vos récapitulatifs." />
        <Tile href="/compare" title="Comparer" desc="Comparer périodes et streams." />
        {isAdmin && <Tile href="/admin" title="Admin" desc="EventSub & webhooks (admins)." />}
      </div>
      {/* Bandeau état rapide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard title="Statut Live" value={liveData ? `En live: ${liveData.title || '—'}` : 'Hors ligne'} hint={liveData ? `${liveData.game_name || '—'} • ${liveData.viewer_count || 0} viewers` : undefined} />
        <InfoCard title="Dernier récap" value={recap?.summary ? `${recap.summary.title || 'Sans titre'} • ${recap.summary.durationMinutes} min` : 'Aucun'} link={recap?.summary ? '/recap' : undefined} />
        <InfoCard title="Prochain stream" value={nextSlot ? new Date(nextSlot.start).toLocaleString() : 'Non planifié'} hint={nextSlot?.title || undefined} />
      </div>
      {/* Bouton manuel d'envoi du récap (visible si on a un récap disponible) */}
      {recap?.summary && (
        <div>
          <button
            disabled={sending}
            onClick={async () => {
              try {
                setSending(true);
                // Récupérer le dernier stream id
                const list = await fetchJSON<{ total: number; items: Array<{ id: number }> }>(`${API_BASE}/api/streams?limit=1`);
                const id = list.items?.[0]?.id;
                if (!id) throw new Error('Stream introuvable');
                // Post request to trigger recap email
                const res = await fetch(`${API_BASE}/api/streams/${id}/recap-email`, { method: 'POST', credentials: 'include' });
                if (!res.ok) {
                  const txt = await res.text().catch(() => res.statusText || 'Erreur');
                  throw new Error(txt || `HTTP ${res.status}`);
                }
                show('Récap envoyé par email (si configuré)', 'success');
              } catch (e: any) {
                show(`Envoi échoué: ${String(e?.message || e)}`, 'error', 6000);
              } finally {
                setSending(false);
              }
            }}
            className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white"
          >
            {sending ? 'Envoi…' : 'Envoyer le récap par mail'}
          </button>
        </div>
      )}
      {/* Publicité pied de page */}
      <div>
        <Adsense slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_BEFORE_FOOTER} placeholderHeight={300} />
      </div>
    </div>
  );
}

function Tile({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="block rounded border p-4 hover:border-[var(--brand)]" style={{ borderColor: 'var(--border)' }}>
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-muted text-sm mt-1">{desc}</div>
    </Link>
  );
}

function InfoCard({ title, value, hint, link }: { title: string; value: string; hint?: string; link?: string }) {
  const content = (
    <div className="rounded border p-4" style={{ borderColor: 'var(--border)' }}>
      <div className="text-sm text-muted">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
  if (link) return <Link href={link}>{content}</Link>;
  return content;
}
