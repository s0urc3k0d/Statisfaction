"use client";
import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { API_BASE, fetchJSON, BestTimesResponse, CategoriesResponse } from '../../../lib/api';
import { Skeleton } from '../../../components/Skeleton';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, Cell, PieChart, Pie, Legend, LineChart, Line } from 'recharts';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'];

export default function AnalyticsPage() {
  const [days, setDays] = useState(90);
  
  const { data: bestTimes, isLoading: btLoading } = useSWR<BestTimesResponse>(
    `${API_BASE}/api/analytics/best-times?days=${days}`, fetchJSON
  );
  const { data: categories, isLoading: catLoading } = useSWR<CategoriesResponse>(
    `${API_BASE}/api/analytics/categories?days=${days}`, fetchJSON
  );

  // Heatmap data - uses the 2D array heatmap[dow][hour]
  const heatmapMatrix = bestTimes?.heatmap ?? [];

  // Best hours for bar chart - aggregate from heatmap
  const bestHoursData = useMemo(() => {
    if (!bestTimes?.heatmap) return [];
    // Sum scores for each hour across all days
    const hourScores: Map<number, { total: number; count: number }> = new Map();
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        const score = bestTimes.heatmap[dow]?.[hour] ?? 0;
        if (score > 0) {
          const existing = hourScores.get(hour) ?? { total: 0, count: 0 };
          hourScores.set(hour, { total: existing.total + score, count: existing.count + 1 });
        }
      }
    }
    // Sort and take top hours
    return Array.from(hourScores.entries())
      .map(([hour, data]) => ({
        hour: `${hour}h`,
        avgViewers: Math.round(data.total / data.count),
      }))
      .sort((a, b) => b.avgViewers - a.avgViewers)
      .slice(0, 12);
  }, [bestTimes]);

  // Best days for bar chart - aggregate from heatmap
  const bestDaysData = useMemo(() => {
    if (!bestTimes?.heatmap) return [];
    const labels = bestTimes.labels?.days ?? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    return bestTimes.heatmap.map((dayRow, dow) => {
      const scores = dayRow.filter(s => s > 0);
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { day: labels[dow], avgViewers: avg };
    }).filter(d => d.avgViewers > 0);
  }, [bestTimes]);

  // Category pie chart data
  const categoryPieData = useMemo(() => {
    if (!categories?.categories) return [];
    return categories.categories.slice(0, 8).map((c, i) => ({
      name: c.category,
      value: c.totalHours * 60, // Convert to minutes for chart
      avgViewers: c.avgViewers,
      color: COLORS[i % COLORS.length],
    }));
  }, [categories]);

  // Category bar chart data (by avg viewers)
  const categoryBarData = useMemo(() => {
    if (!categories?.categories) return [];
    return categories.categories.slice(0, 10).map(c => ({
      category: c.category.length > 15 ? c.category.slice(0, 15) + '...' : c.category,
      avgViewers: c.avgViewers,
      peakViewers: c.peakViewers,
      followersPerHour: c.followersPerHour,
    }));
  }, [categories]);

  const getHeatmapColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-emerald-600/80';
    if (score >= 40) return 'bg-amber-500/70';
    if (score >= 20) return 'bg-amber-600/50';
    return 'bg-gray-700/50';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">📊 Analytics avancées</h1>
          <p className="text-gray-400">Optimise tes streams avec des données sur les meilleurs moments et catégories</p>
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="bg-gray-900 border border-gray-700 rounded px-3 py-2"
        >
          <option value={30}>30 derniers jours</option>
          <option value={60}>60 derniers jours</option>
          <option value={90}>90 derniers jours</option>
          <option value={180}>6 mois</option>
          <option value={365}>1 an</option>
        </select>
      </div>

      {/* Recommandations */}
      {bestTimes?.recommendations && bestTimes.recommendations.length > 0 && (
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4">
          <h2 className="font-semibold text-indigo-300 mb-2">🎯 Recommandations</h2>
          <ul className="text-indigo-200 space-y-1">
            {bestTimes.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Heatmap des meilleurs créneaux */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
        <h2 className="font-semibold mb-4">🗓️ Heatmap des performances</h2>
        {btLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Header hours */}
              <div className="flex mb-1">
                <div className="w-20 flex-shrink-0" />
                {HOURS.filter(h => h % 2 === 0).map(h => (
                  <div key={h} className="flex-1 text-center text-xs text-gray-500">{h}h</div>
                ))}
              </div>
              
              {/* Rows for each day */}
              {DAYS.map((day, dow) => (
                <div key={dow} className="flex items-center mb-1">
                  <div className="w-20 flex-shrink-0 text-sm text-gray-400">{day}</div>
                  <div className="flex-1 flex gap-0.5">
                    {HOURS.map(hour => {
                      const score = heatmapMatrix[dow]?.[hour] ?? 0;
                      return (
                        <div
                          key={hour}
                          className={`flex-1 h-8 rounded-sm ${getHeatmapColor(score)} transition-colors cursor-pointer hover:ring-2 hover:ring-white/30`}
                          title={score > 0 ? `${day} ${hour}h: Score ${score}` : `${day} ${hour}h: Pas de données`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {/* Legend */}
              <div className="flex items-center justify-end gap-4 mt-4 text-xs text-gray-500">
                <span>Moins performant</span>
                <div className="flex gap-1">
                  <div className="w-6 h-4 rounded bg-gray-700/50" />
                  <div className="w-6 h-4 rounded bg-amber-600/50" />
                  <div className="w-6 h-4 rounded bg-amber-500/70" />
                  <div className="w-6 h-4 rounded bg-emerald-600/80" />
                  <div className="w-6 h-4 rounded bg-emerald-500" />
                </div>
                <span>Plus performant</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Best hours & days */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-4">⏰ Meilleures heures</h2>
          {btLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bestHoursData}>
                <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" />
                <ReTooltip 
                  contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }}
                  formatter={(value: number, name: string) => [value, name === 'avgViewers' ? 'Viewers moy.' : name]}
                />
                <Bar dataKey="avgViewers" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {bestHoursData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#10b981' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
          <h2 className="font-semibold mb-4">📅 Meilleurs jours</h2>
          {btLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bestDaysData}>
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" />
                <ReTooltip 
                  contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }}
                  formatter={(value: number) => [value, 'Viewers moy.']}
                />
                <Bar dataKey="avgViewers" fill="#10b981" radius={[4, 4, 0, 0]}>
                  {bestDaysData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Categories section */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
        <h2 className="font-semibold mb-4">🎮 Performance par catégorie</h2>
        {catLoading ? (
          <Skeleton className="h-64" />
        ) : categories?.categories.length === 0 ? (
          <div className="text-center text-gray-500 py-8">Pas assez de données sur les catégories</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart of time spent */}
            <div>
              <h3 className="text-sm text-gray-400 mb-2">Temps passé par catégorie</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name.slice(0, 10)} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categoryPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip 
                    contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${Math.round(value / 60)}h - ${props.payload.avgViewers} viewers moy.`,
                      props.payload.name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart of performance */}
            <div>
              <h3 className="text-sm text-gray-400 mb-2">Viewers moyens par catégorie</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryBarData} layout="vertical">
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis type="category" dataKey="category" width={100} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <ReTooltip 
                    contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }}
                    formatter={(value: number, name: string) => [
                      value, 
                      name === 'avgViewers' ? 'Viewers moy.' : name === 'peakViewers' ? 'Pic' : 'Follows/h'
                    ]}
                  />
                  <Bar dataKey="avgViewers" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Detailed category table */}
      {categories && categories.categories.length > 0 && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg overflow-hidden">
          <h3 className="font-semibold p-4 border-b border-gray-800">📋 Détails par catégorie</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-2 text-left">Catégorie</th>
                  <th className="px-4 py-2 text-right">Streams</th>
                  <th className="px-4 py-2 text-right">Temps total</th>
                  <th className="px-4 py-2 text-right">Viewers moy.</th>
                  <th className="px-4 py-2 text-right">Pic</th>
                  <th className="px-4 py-2 text-right">Follows/h</th>
                  <th className="px-4 py-2 text-right">vs Moyenne</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {categories.categories.map((c, i) => (
                  <tr key={c.category} className={i === 0 ? 'bg-emerald-900/20' : ''}>
                    <td className="px-4 py-3">
                      <span className="font-medium">
                        {c.category}
                        {i === 0 && <span className="ml-2">⭐</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{c.streams}</td>
                    <td className="px-4 py-3 text-right font-mono">{c.totalHours}h</td>
                    <td className="px-4 py-3 text-right font-mono">{c.avgViewers}</td>
                    <td className="px-4 py-3 text-right font-mono">{c.peakViewers}</td>
                    <td className="px-4 py-3 text-right font-mono">{c.followersPerHour.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={c.performanceVsAvg >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {c.performanceVsAvg >= 0 ? '↗' : '↘'} {Math.abs(c.performanceVsAvg)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top category recommendation */}
      {categories?.topCategories && categories.topCategories.length > 0 && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4">
          <h2 className="font-semibold text-amber-300 mb-2">🏆 Catégories les plus performantes</h2>
          <ul className="text-amber-200 space-y-1">
            {categories.topCategories.map((c) => (
              <li key={c.category}>
                <strong>{c.category}</strong> avec {c.avgViewers} viewers en moyenne 
                sur {c.streams} streams ({c.totalHours}h de stream).
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Category recommendations */}
      {categories?.recommendations && categories.recommendations.length > 0 && (
        <div className="bg-violet-900/30 border border-violet-700 rounded-lg p-4">
          <h2 className="font-semibold text-violet-300 mb-2">💡 Conseils</h2>
          <ul className="text-violet-200 space-y-1">
            {categories.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
