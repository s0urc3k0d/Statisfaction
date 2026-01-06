"use client";
import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE, fetchJSON, LastStreamResponse, Annotation, RetentionResponse } from '../../../../lib/api';
import { Skeleton } from '../../../../components/Skeleton';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, Tooltip as ReTooltip, Legend, Cell, ReferenceLine, AreaChart, Area } from 'recharts';

type StreamDetail = LastStreamResponse;

export default function StreamDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data, error, isLoading } = useSWR<StreamDetail>(id ? `${API_BASE}/api/streams/${id}` : null, fetchJSON);
  type ConvResp = { stream: { id: number; title: string | null; category: string | null; startedAt: string; endedAt: string | null; durationMinutes: number }; followers: { at: number; id: string; login: string | null; name: string | null }[]; buckets: { t: number; count: number }[]; total: number; ratePerHour: number };
  const { data: conv } = useSWR<ConvResp>(id ? `${API_BASE}/api/streams/${id}/conversion` : null, fetchJSON);
  const { data: retention, isLoading: retLoading } = useSWR<RetentionResponse>(id ? `${API_BASE}/api/streams/${id}/retention` : null, fetchJSON);
  const rawViewers = data?.series ?? [];
  // Construire une série composée alignée sur les buckets 5min
  const composed = useMemo(() => {
    if (!conv || !conv.buckets) return null;
    const vpts = rawViewers.map(p => ({ t: p.t as number, viewers: p.viewers as number })).sort((a,b)=>a.t-b.t);
    let vi = 0;
    const arr = conv.buckets.map(b => {
      const bt = b.t;
      while (vi + 1 < vpts.length && vpts[vi + 1].t <= bt) vi++;
      const curr = vpts[vi];
      return {
        time: new Date(bt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        follows: b.count,
        viewers: curr ? curr.viewers : undefined,
        t: bt,
      };
    });
    // Spike detector: spike si hausse >=15 viewers et >=30% vs bucket précédent
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i-1];
      const curr = arr[i];
      const pv = typeof prev.viewers === 'number' ? prev.viewers : undefined;
      const cv = typeof curr.viewers === 'number' ? curr.viewers : undefined;
      let spike = false;
      if (typeof pv === 'number' && typeof cv === 'number' && pv > 0) {
        const delta = cv - pv;
        const pct = delta / pv;
        if (delta >= 15 && pct >= 0.3) spike = true;
      }
      (arr[i] as any).spike = spike;
    }
    return arr as Array<{ time: string; follows: number; viewers?: number; t: number; spike?: boolean }>;
  }, [conv, rawViewers]);

  const [showViewers, setShowViewers] = useState(true);
  const [showFollowers, setShowFollowers] = useState(true);
  const { data: anns, mutate: mutateAnns } = useSWR<Annotation[]>(id ? `${API_BASE}/api/annotations?streamId=${id}` : null, fetchJSON);
  const [annForm, setAnnForm] = useState<{ type: string; label: string }>({ type: 'event', label: '' });
  const addAnn = async () => {
    if (!id || !annForm.label) return;
    const nowIso = new Date().toISOString();
    await fetchJSON(`${API_BASE}/api/annotations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ streamId: Number(id), at: nowIso, type: annForm.type, label: annForm.label }) });
    setAnnForm({ type: 'event', label: '' });
    mutateAnns();
  };
  const delAnn = async (annId: number) => {
    await fetchJSON(`${API_BASE}/api/annotations/${annId}`, { method: 'DELETE' });
    mutateAnns();
  };
  // Hotkeys: T=titre, G=jeu, R=raid, E=event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 't') setAnnForm(f => ({ ...f, type: 'title' }));
      if (k === 'g') setAnnForm(f => ({ ...f, type: 'game' }));
      if (k === 'r') setAnnForm(f => ({ ...f, type: 'raid' }));
      if (k === 'e') setAnnForm(f => ({ ...f, type: 'event' }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const annMarks = useMemo(() => {
    const arr = (anns || []).map(a => {
      const time = new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let color = '#22c55e';
      if (a.type === 'raid') color = '#ef4444';
      else if (a.type === 'title') color = '#6366f1';
      else if (a.type === 'game') color = '#f59e0b';
      return { x: time, label: a.label, color, id: a.id };
    });
    return arr;
  }, [anns]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Détail du stream</h1>
        <Link 
          href={`/chat/${id}`}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
        >
          💬 Analyse du chat
        </Link>
      </div>
      {isLoading && (
        <div className="space-y-2">
          <Skeleton variant="card" className="h-16" />
          <Skeleton variant="card" className="h-64" />
        </div>
      )}
      {error && <div className="text-red-400">Erreur de chargement.</div>}
      {data && (
        <div className="space-y-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded p-4">
            <div className="font-medium">{data.summary?.title || 'Sans titre'}</div>
            <div className="text-sm text-gray-400">{data.summary?.category || 'Catégorie inconnue'} • {data.summary?.durationMinutes} min • pic {data.summary?.peakViewers} • moy {data.summary?.avgViewers}</div>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Viewers vs Followers pendant le stream</div>
              <div className="flex items-center gap-2 text-xs">
                <button onClick={()=>setShowViewers(v=>!v)} className={`px-2 py-1 rounded border ${showViewers?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>Viewers</button>
                <button onClick={()=>setShowFollowers(v=>!v)} className={`px-2 py-1 rounded border ${showFollowers?'border-orange-500 text-orange-300':'border-gray-800 text-gray-300'}`}>Followers</button>
                {conv && (
                  <div className="ml-2 text-gray-400">Followers: {conv.total} • {conv.ratePerHour}/h</div>
                )}
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {composed ? (
                  <ComposedChart data={composed}>
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#94a3b8" allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f97316" allowDecimals={false} />
                    <ReTooltip contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }} />
                    <Legend />
                    {showFollowers && (
                      <Bar yAxisId="right" dataKey="follows" name="Follows (5 min)" opacity={0.9}
                           fill="#f97316">
                        {(composed as any[]).map((d, i) => (
                          <Cell key={`c-${i}`} fill={d.spike ? '#ef4444' : '#f97316'} />
                        ))}
                      </Bar>
                    )}
                    {showViewers && (
                      <Line yAxisId="left" type="monotone" dataKey="viewers" name="Viewers" stroke="#6366f1" strokeWidth={2} dot={false} />
                    )}
                    {annMarks.map(m => (
                      <ReferenceLine key={`ann-${m.id}`} x={m.x} stroke={m.color} strokeDasharray="3 3" label={{ value: m.label, position: 'top', fill: m.color, fontSize: 10 }} />
                    ))}
                  </ComposedChart>
                ) : (
                  <ComposedChart data={rawViewers.map(p=>({ time: new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), viewers: p.viewers }))}>
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#94a3b8" allowDecimals={false} />
                    <ReTooltip contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }} />
                    <Legend />
                    {showViewers && (
                      <Line yAxisId="left" type="monotone" dataKey="viewers" name="Viewers" stroke="#6366f1" strokeWidth={2} dot={false} />
                    )}
                    {annMarks.map(m => (
                      <ReferenceLine key={`ann2-${m.id}`} x={m.x} stroke={m.color} strokeDasharray="3 3" label={{ value: m.label, position: 'top', fill: m.color, fontSize: 10 }} />
                    ))}
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>

            {conv && conv.followers.length > 0 ? (
              <div className="mt-3 text-sm text-gray-300">
                <div className="text-xs text-gray-400 mb-1">Derniers follows</div>
                <div className="max-h-40 overflow-auto divide-y divide-gray-800">
                  {conv.followers.slice(-10).reverse().map((f, idx) => (
                    <div key={idx} className="py-1 flex items-center justify-between">
                      <div>{f.name || f.login || f.id}</div>
                      <div className="text-xs text-gray-400">{new Date(f.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Retention Analysis */}
          <div className="bg-gray-900/60 border border-gray-800 rounded p-4">
            <div className="font-medium mb-3">📉 Analyse de rétention</div>
            {retLoading ? (
              <Skeleton className="h-64" />
            ) : retention ? (
              <div className="space-y-4">
                {/* Summary metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-800/50 rounded p-3 text-center">
                    <p className="text-xl font-bold text-indigo-400">{retention.initialViewers}</p>
                    <p className="text-xs text-gray-500">Viewers initiaux</p>
                  </div>
                  <div className="bg-gray-800/50 rounded p-3 text-center">
                    <p className="text-xl font-bold text-emerald-400">{retention.curve[retention.curve.length - 1]?.viewers ?? 0}</p>
                    <p className="text-xs text-gray-500">Viewers finaux</p>
                  </div>
                  <div className="bg-gray-800/50 rounded p-3 text-center">
                    <p className={`text-xl font-bold ${retention.avgRetention >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {retention.avgRetention}%
                    </p>
                    <p className="text-xs text-gray-500">Rétention moyenne</p>
                  </div>
                  <div className="bg-gray-800/50 rounded p-3 text-center">
                    <p className="text-xl font-bold text-pink-400">{retention.dropOffs.length}</p>
                    <p className="text-xs text-gray-500">Points de décrochage</p>
                  </div>
                </div>

                {/* Retention curve */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={retention.curve}>
                      <defs>
                        <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="pct" 
                        tickFormatter={v => `${v}%`} 
                        stroke="#94a3b8" 
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        tickFormatter={v => `${v}%`}
                        stroke="#94a3b8"
                        tick={{ fontSize: 11 }}
                      />
                      <ReTooltip 
                        contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }}
                        formatter={(value: number, name: string) => [
                          `${value}% (${retention.curve.find(p => p.retention === value)?.viewers ?? '?'} viewers)`,
                          'Rétention'
                        ]}
                        labelFormatter={v => `${v}% du stream (${retention.curve.find(p => p.pct === v)?.minutes ?? '?'}min)`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="retention" 
                        stroke="#6366f1" 
                        strokeWidth={2}
                        fill="url(#retentionGradient)"
                      />
                      {/* Drop-off markers */}
                      {retention.dropOffs.map((d, i) => (
                        <ReferenceLine 
                          key={i}
                          x={d.pct} 
                          stroke="#ef4444" 
                          strokeDasharray="3 3"
                          label={{ 
                            value: `↓${d.drop}%`, 
                            position: 'top', 
                            fill: '#ef4444', 
                            fontSize: 10 
                          }}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Drop-off details */}
                {retention.dropOffs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Points de décrochage significatifs</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {retention.dropOffs.map((d, i) => (
                        <div key={i} className="bg-red-900/20 border border-red-800/50 rounded p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">À {d.pct}% ({d.minute}min)</span>
                            <span className="text-red-400 font-bold">-{d.drop}%</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {d.possibleCause}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rating & Trend */}
                <div className="bg-indigo-900/20 border border-indigo-800 rounded p-3">
                  <h4 className="text-sm font-medium text-indigo-300 mb-2">💡 Évaluation</h4>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`font-medium ${
                      retention.rating === 'excellent' ? 'text-emerald-400' :
                      retention.rating === 'good' ? 'text-green-400' :
                      retention.rating === 'average' ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {retention.rating === 'excellent' ? '🏆 Excellent' :
                       retention.rating === 'good' ? '✅ Bon' :
                       retention.rating === 'average' ? '📊 Moyen' : '⚠️ À améliorer'}
                    </span>
                    <span className="text-gray-400">
                      Tendance : {retention.trend === 'stable' ? '📈 Stable' : 
                                 retention.trend === 'declining' ? '📉 En baisse' : '⬇️ Forte baisse'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">Pas assez de données pour l'analyse de rétention</div>
            )}
          </div>

          {/* Annotations UI */}
          <div className="bg-gray-900/60 border border-gray-800 rounded p-4">
            <div className="font-medium mb-2">Annotations</div>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div>
                <div className="text-sm text-gray-400">Type</div>
                <select value={annForm.type} onChange={e=>setAnnForm(f=>({ ...f, type: e.target.value }))} className="bg-gray-950 border border-gray-800 rounded px-2 py-1">
                  <option value="event">Événement</option>
                  <option value="title">Changement de titre</option>
                  <option value="game">Changement de jeu</option>
                  <option value="raid">Raid</option>
                </select>
              </div>
              <div className="flex-1 min-w-[240px]">
                <div className="text-sm text-gray-400">Label</div>
                <input value={annForm.label} onChange={e=>setAnnForm(f=>({ ...f, label: e.target.value }))} placeholder="Ex: Nouveau titre: ..." className="w-full bg-gray-950 border border-gray-800 rounded px-2 py-1" />
              </div>
              <button onClick={addAnn} className="px-3 py-1 bg-indigo-600 rounded hover:bg-indigo-500">Ajouter</button>
              <div className="text-xs text-gray-500">Raccourcis: T=Title, G=Game, R=Raid, E=Event</div>
            </div>
            <div className="text-sm divide-y divide-gray-800">
              {(anns || []).map(a => (
                <div key={a.id} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 text-xs rounded bg-gray-800 mr-2">{a.type}</span>
                    <span className="text-gray-300">{a.label}</span>
                    <span className="text-xs text-gray-500 ml-2">{new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <button onClick={()=>delAnn(a.id)} className="text-xs text-red-400 hover:text-red-300">Supprimer</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
