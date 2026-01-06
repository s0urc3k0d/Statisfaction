"use client";
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { API_BASE, fetchJSON, StreamCompareResponse } from '../../../lib/api';
import { Skeleton } from '../../../components/Skeleton';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, Legend, BarChart, Bar } from 'recharts';

type StreamsList = { total: number; items: { id: number; title: string | null; category: string | null; startedAt: string; endedAt: string | null; durationMinutes: number; peakViewers: number; avgViewers: number }[] };

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];

export default function ComparePage() {
  const { data: list, isLoading: listLoading } = useSWR<StreamsList>(`${API_BASE}/api/streams?limit=50&offset=0`, fetchJSON);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const idsParam = selectedIds.join(',');
  const compareKey = selectedIds.length >= 2 ? `${API_BASE}/api/streams/compare?ids=${idsParam}` : null;
  const { data: comparison, isLoading: compareLoading, error: compareError } = useSWR<StreamCompareResponse>(compareKey, fetchJSON);

  const toggleStream = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  };

  // Données pour le graphique superposé
  const chartData = useMemo(() => {
    if (!comparison?.streams) return [];
    const map = new Map<number, Record<string, number>>();
    
    for (const stream of comparison.streams) {
      for (const point of stream.series) {
        const existing = map.get(point.pct) || { pct: point.pct };
        existing[`stream_${stream.id}`] = point.viewers;
        map.set(point.pct, existing);
      }
    }
    
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);
  }, [comparison]);

  // Données pour le bar chart
  const barData = useMemo(() => {
    if (!comparison?.streams) return [];
    return comparison.streams.map((s, i) => ({
      name: s.title?.slice(0, 20) || `Stream ${s.id}`,
      avgViewers: s.avgViewers,
      peakViewers: s.peakViewers,
      followers: s.followers,
      color: COLORS[i % COLORS.length],
    }));
  }, [comparison]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">📊 Comparaison de streams</h1>
        <p className="text-gray-400">Sélectionne 2 à 10 streams pour les comparer</p>
      </div>

      {/* Sélection des streams */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
        <h2 className="font-semibold mb-3">Sélectionner les streams ({selectedIds.length}/10)</h2>
        
        {listLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {list?.items.map(s => (
              <label
                key={s.id}
                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                  selectedIds.includes(s.id) 
                    ? 'bg-indigo-500/20 border border-indigo-500/50' 
                    : 'hover:bg-gray-800/50 border border-transparent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleStream(s.id)}
                  disabled={!selectedIds.includes(s.id) && selectedIds.length >= 10}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.title || 'Sans titre'}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(s.startedAt)} • {s.category || 'N/A'} • {s.avgViewers} avg
                  </p>
                </div>
                <span className="text-sm text-gray-500">{s.durationMinutes}min</span>
              </label>
            ))}
          </div>
        )}
        
        {selectedIds.length > 0 && (
          <button
            onClick={() => setSelectedIds([])}
            className="mt-3 text-sm text-red-400 hover:underline"
          >
            Tout désélectionner
          </button>
        )}
      </div>

      {/* Résultats de la comparaison */}
      {selectedIds.length < 2 ? (
        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
          Sélectionne au moins 2 streams pour commencer la comparaison
        </div>
      ) : compareLoading ? (
        <Skeleton className="h-96" />
      ) : compareError ? (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          Erreur lors de la comparaison
        </div>
      ) : comparison ? (
        <div className="space-y-6">
          {/* Facteurs de succès */}
          {comparison.factors.length > 0 && (
            <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-4">
              <h3 className="font-semibold text-emerald-400 mb-2">💡 Facteurs de succès identifiés</h3>
              <ul className="space-y-1">
                {comparison.factors.map((f, i) => (
                  <li key={i} className="text-emerald-300">• {f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Moyennes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-indigo-400">{comparison.averages.avgViewers}</p>
              <p className="text-sm text-gray-500">Viewers moyens</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{comparison.averages.peakViewers}</p>
              <p className="text-sm text-gray-500">Pic moyen</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{comparison.averages.durationMinutes}m</p>
              <p className="text-sm text-gray-500">Durée moyenne</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-pink-400">{comparison.averages.followers}</p>
              <p className="text-sm text-gray-500">Followers moyens</p>
            </div>
          </div>

          {/* Graphique superposé */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-4">📈 Courbes de viewers superposées</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <XAxis dataKey="pct" tickFormatter={v => `${v}%`} stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <ReTooltip 
                  contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }}
                  formatter={(value: number, name: string) => {
                    const streamId = name.replace('stream_', '');
                    const stream = comparison.streams.find(s => s.id === Number(streamId));
                    return [value, stream?.title?.slice(0, 15) || `Stream ${streamId}`];
                  }}
                  labelFormatter={v => `${v}% du stream`}
                />
                <Legend formatter={(value) => {
                  const streamId = value.replace('stream_', '');
                  const stream = comparison.streams.find(s => s.id === Number(streamId));
                  return stream?.title?.slice(0, 20) || `Stream ${streamId}`;
                }} />
                {comparison.streams.map((s, i) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={`stream_${s.id}`}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart comparatif */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold mb-4">📊 Comparaison des métriques</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <ReTooltip contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }} />
                <Bar dataKey="avgViewers" name="Viewers moy." fill="#6366f1" />
                <Bar dataKey="followers" name="Followers" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tableau détaillé */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
            <h3 className="font-semibold p-4 border-b border-gray-800">📋 Détails par stream</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-2 text-left">Stream</th>
                    <th className="px-4 py-2 text-right">Viewers moy.</th>
                    <th className="px-4 py-2 text-right">Pic</th>
                    <th className="px-4 py-2 text-right">Durée</th>
                    <th className="px-4 py-2 text-right">Followers</th>
                    <th className="px-4 py-2 text-right">Tendance</th>
                    <th className="px-4 py-2 text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {comparison.streams.map((s, i) => (
                    <tr key={s.id} className={s.id === comparison.bestStreamId ? 'bg-emerald-900/20' : ''}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]">
                              {s.title || 'Sans titre'}
                              {s.id === comparison.bestStreamId && <span className="ml-2">🏆</span>}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(s.startedAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{s.avgViewers}</td>
                      <td className="px-4 py-3 text-right font-mono">{s.peakViewers}</td>
                      <td className="px-4 py-3 text-right font-mono">{s.durationMinutes}m</td>
                      <td className="px-4 py-3 text-right font-mono">{s.followers}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={s.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {s.trend >= 0 ? '↗' : '↘'} {Math.abs(s.trend)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={s.deltas.avgViewersPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {s.deltas.avgViewersPct >= 0 ? '+' : ''}{s.deltas.avgViewersPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Performance par jour */}
          {comparison.dayPerformance.length > 1 && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
              <h3 className="font-semibold mb-4">📅 Performance par jour de la semaine</h3>
              <div className="grid grid-cols-7 gap-2">
                {comparison.dayPerformance.map((d, i) => (
                  <div
                    key={d.dow}
                    className={`p-3 rounded text-center ${i === 0 ? 'bg-emerald-900/30 border border-emerald-700' : 'bg-gray-800/50'}`}
                  >
                    <p className="font-semibold text-sm">{d.dayName}</p>
                    <p className="text-lg font-bold">{d.avgViewers}</p>
                    <p className="text-xs text-gray-500">{d.count} stream{d.count > 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
