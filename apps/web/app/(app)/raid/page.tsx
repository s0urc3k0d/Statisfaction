"use client";
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { API_BASE, fetchJSON } from '../../../lib/api';
import { useToast } from '../../../components/Toast';

type Candidate = { userId: string; login: string; name: string; gameName: string | null; viewerCount: number; startedAt: string; score?: number };

export default function RaidPlannerPage() {
  const { show } = useToast();
  const [sameCategory, setSameCategory] = useState(true);
  const [fromFollowings, setFromFollowings] = useState(true);
  const [recentMinutes, setRecentMinutes] = useState(120);
  const [minViewers, setMinViewers] = useState(0);
  const [maxViewers, setMaxViewers] = useState(0);
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (sameCategory) p.set('sameCategory', '1');
    if (fromFollowings) p.set('from', 'followings');
    if (recentMinutes) p.set('recentMinutes', String(recentMinutes));
    if (minViewers) p.set('minViewers', String(minViewers));
    if (maxViewers) p.set('maxViewers', String(maxViewers));
    return p.toString();
  }, [sameCategory, fromFollowings, recentMinutes, minViewers, maxViewers]);

  const { data, isLoading, mutate } = useSWR<{ items: Candidate[] }>(`${API_BASE}/api/raid/candidates?${qs}`, fetchJSON);
  const items = useMemo(()=>{
    if (!data?.items) return [] as Candidate[];
    return [...data.items].sort((a,b)=> (b.score ?? 0) - (a.score ?? 0));
  }, [data]);

  const copyRaid = (login: string) => {
    navigator.clipboard.writeText(`/raid ${login}`);
    show('Commande /raid copiée', 'success');
  };
  const startRaid = async (userId: string) => {
    try {
      const r = await fetchJSON<{ ok: boolean }>(`${API_BASE}/api/raid/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUserId: userId }) });
      if ((r as any).ok) show('Raid démarré (Twitch).', 'success'); else show('Raid non démarré (droits ?)', 'warning');
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) {
        show('Autorisation manquante: channel:manage:raids. Cliquez Re-consent dans Outils.', 'warning');
      } else {
        show('Échec du démarrage du raid', 'error');
      }
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Planificateur de raid</h1>
      <div className="bg-gray-900/60 border border-gray-800 rounded p-4 flex flex-wrap items-end gap-3">
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand" checked={sameCategory} onChange={e=>setSameCategory(e.target.checked)} /><span>Même catégorie</span></label>
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand" checked={fromFollowings} onChange={e=>setFromFollowings(e.target.checked)} /><span>Parmi mes suivis</span></label>
        <div>
          <div className="text-sm text-gray-400">Lancé depuis (min)</div>
          <input type="number" value={recentMinutes} onChange={e=>setRecentMinutes(Math.max(0, Number(e.target.value||0)))} className="bg-gray-950 border border-gray-800 rounded px-2 py-1 w-28" />
        </div>
        <div>
          <div className="text-sm text-gray-400">Viewers min</div>
          <input type="number" value={minViewers} onChange={e=>setMinViewers(Math.max(0, Number(e.target.value||0)))} className="bg-gray-950 border border-gray-800 rounded px-2 py-1 w-28" />
        </div>
        <div>
          <div className="text-sm text-gray-400">Viewers max</div>
          <input type="number" value={maxViewers} onChange={e=>setMaxViewers(Math.max(0, Number(e.target.value||0)))} className="bg-gray-950 border border-gray-800 rounded px-2 py-1 w-28" />
        </div>
        <button onClick={()=>mutate()} className="px-3 py-2 bg-indigo-600 rounded hover:bg-indigo-500">Rafraîchir</button>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded p-4">
        {isLoading ? (
          <div className="text-gray-400">Chargement…</div>
        ) : !items || items.length===0 ? (
          <div className="text-gray-400">Aucune suggestion pour l’instant.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((c, i) => (
              <div key={i} className="border border-gray-800 rounded p-3 bg-gray-950 space-y-1">
                <div className="font-medium">{c.name} <span className="text-gray-400">@{c.login}</span></div>
                <div className="text-sm text-gray-300">{c.gameName || '—'} • {c.viewerCount} viewers</div>
                {typeof c.score === 'number' && (<div className="text-xs text-gray-400">Score: {(c.score*100).toFixed(0)}%</div>)}
                <div className="flex items-center gap-2 text-sm pt-1">
                  <button onClick={()=>copyRaid(c.login)} className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700">Copier /raid</button>
                  <button onClick={()=>startRaid(c.userId)} className="px-2 py-1 bg-teal-700 rounded hover:bg-teal-600">Lancer le raid</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
