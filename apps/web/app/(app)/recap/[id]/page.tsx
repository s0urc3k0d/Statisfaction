"use client";
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { API_BASE, fetchJSON } from '../../../../lib/api';
import { useToast } from '../../../../components/Toast';

type Recap = {
  stream: { id: number; title: string | null; category: string | null; startedAt: string; endedAt: string | null; durationMinutes: number };
  kpis: { avgViewers: number; peakViewers: number; newFollowers: number };
  moments: Array<{ t: number; delta: number; from: number; to: number }>;
  funFacts: { topEmote: string | null };
};

export default function RecapPage() {
  const params = useParams<{ id: string }>();
  const { show } = useToast();
  const { data, isLoading } = useSWR<Recap>(`${API_BASE}/api/streams/${params.id}/recap`, fetchJSON);
  if (isLoading) return <div className="text-gray-400">Chargement…</div>;
  if (!data) return <div className="text-gray-400">Aucun récap disponible.</div>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Récapitulatif du stream</h1>
      <div>
        <button
          onClick={async ()=>{
            try {
              const r = await fetch(`${API_BASE}/api/streams/${data.stream.id}/recap-email`, { method: 'POST', credentials: 'include' });
              if (!r.ok) throw new Error(String(r.status));
              const j = await r.json();
              if (j?.ok) show('Récap envoyé par email.', 'success'); else show('Envoi impossible (voir configuration email).', 'error');
            } catch (e) {
              show("Échec de l'envoi de l'email.", 'error');
            }
          }}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded"
        >Envoyer le récap par mail</button>
      </div>
      <div className="bg-gray-900/60 border border-gray-800 rounded p-4">
        <div className="text-lg font-medium">{data.stream.title || 'Sans titre'}</div>
        <div className="text-sm text-gray-300">Catégorie: {data.stream.category || '—'}</div>
        <div className="text-sm text-gray-300">Durée: {data.stream.durationMinutes} min</div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-gray-900/60 border border-gray-800 rounded p-4"><div className="text-sm text-gray-400">Moyenne viewers</div><div className="text-2xl font-semibold">{data.kpis.avgViewers}</div></div>
        <div className="bg-gray-900/60 border border-gray-800 rounded p-4"><div className="text-sm text-gray-400">Pic viewers</div><div className="text-2xl font-semibold">{data.kpis.peakViewers}</div></div>
        <div className="bg-gray-900/60 border border-gray-800 rounded p-4"><div className="text-sm text-gray-400">Nouveaux followers</div><div className="text-2xl font-semibold">{data.kpis.newFollowers}</div></div>
      </div>
      <div className="bg-gray-900/60 border border-gray-800 rounded p-4">
        <div className="font-medium mb-2">Moments à clipper</div>
        {data.moments.length === 0 ? (
          <div className="text-gray-400">Aucun moment remarqué par l’algorithme.</div>
        ) : (
          <div className="space-y-2">
            {data.moments.map((m, i) => (
              <div key={i} className="flex items-center justify-between border border-gray-800 rounded px-2 py-1">
                <div className="text-gray-200">{new Date(m.t).toLocaleTimeString()} • +{m.delta} viewers (de {m.from} à {m.to})</div>
                <div className="flex items-center gap-2">
                  <a href={`#`} onClick={async (e)=>{ e.preventDefault(); try {
                    const r = await fetch(`${API_BASE}/api/streams/${data.stream.id}/vod-link?at=${encodeURIComponent(m.t - new Date(data.stream.startedAt).getTime())}`, { credentials: 'include' });
                    const j = await r.json(); if (j?.url) window.open(j.url, '_blank');
                  } catch {} }} className="px-2 py-1 text-sm bg-gray-800 rounded hover:bg-gray-700">Ouvrir VOD</a>
                  <button onClick={async ()=>{
                    try { await fetch(`${API_BASE}/api/streams/${data.stream.id}/clips`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }); } catch {}
                  }} className="px-2 py-1 text-sm bg-teal-700 rounded hover:bg-teal-600">Créer un clip</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-gray-900/60 border border-gray-800 rounded p-4">
        <div className="font-medium mb-2">Fun facts</div>
        <div className="text-gray-300">Émote la plus utilisée: {data.funFacts.topEmote || '—'}</div>
      </div>
    </div>
  );
}
