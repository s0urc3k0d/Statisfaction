"use client";
import useSWR from 'swr';
import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  API_BASE, fetchJSON, 
  WordCloudResponse, ChatTimelineResponse, ChatMomentsResponse, 
  SentimentResponse, CorrelationResponse 
} from '../../../../lib/api';
import { Skeleton } from '../../../../components/Skeleton';
import { 
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip as ReTooltip, Legend, ScatterChart, Scatter, Cell
} from 'recharts';

type StreamInfo = { id: number; title: string | null; category: string | null; startedAt: string; endedAt: string | null };

const SENTIMENT_COLORS = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444'
};

export default function ChatAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const streamId = params?.id;
  const [activeTab, setActiveTab] = useState<'overview' | 'wordcloud' | 'moments' | 'sentiment'>('overview');
  const [includeEmotes, setIncludeEmotes] = useState(false);

  // Fetch data
  const { data: stream } = useSWR<StreamInfo>(
    streamId ? `${API_BASE}/api/streams/${streamId}` : null, 
    (url: string) => fetchJSON<{ summary: StreamInfo }>(url).then(r => r.summary)
  );
  
  const { data: timeline, isLoading: timelineLoading } = useSWR<ChatTimelineResponse>(
    streamId ? `${API_BASE}/api/streams/${streamId}/chat/timeline` : null, fetchJSON
  );
  
  const { data: wordcloud, isLoading: wordcloudLoading } = useSWR<WordCloudResponse>(
    streamId ? `${API_BASE}/api/streams/${streamId}/chat/wordcloud?limit=80&includeEmotes=${includeEmotes}` : null, fetchJSON
  );
  
  const { data: moments, isLoading: momentsLoading } = useSWR<ChatMomentsResponse>(
    streamId ? `${API_BASE}/api/streams/${streamId}/chat/moments` : null, fetchJSON
  );
  
  const { data: sentiment, isLoading: sentimentLoading } = useSWR<SentimentResponse>(
    streamId ? `${API_BASE}/api/streams/${streamId}/chat/sentiment` : null, fetchJSON
  );
  
  const { data: correlation } = useSWR<CorrelationResponse>(
    streamId ? `${API_BASE}/api/streams/${streamId}/chat/correlation` : null, fetchJSON
  );

  // Combined chart data (messages + viewers)
  const combinedData = useMemo(() => {
    if (!timeline?.timeline) return [];
    return timeline.timeline.map(t => ({
      minute: t.minute,
      messages: t.messages,
      viewers: t.viewers,
      engagement: t.messagesPerViewer ? Math.round(t.messagesPerViewer * 100) : 0
    }));
  }, [timeline]);

  const formatMinute = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/history" className="hover:text-white">Historique</Link>
            <span>/</span>
            <Link href={`/history/${streamId}`} className="hover:text-white">Stream #{streamId}</Link>
            <span>/</span>
            <span>Chat Analytics</span>
          </div>
          <h1 className="text-2xl font-bold">💬 Analyse du chat</h1>
          {stream && (
            <p className="text-gray-400 truncate max-w-lg">{stream.title || 'Sans titre'}</p>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex gap-2">
          {(['overview', 'wordcloud', 'moments', 'sentiment'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                activeTab === tab 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab === 'overview' && '📊 Vue générale'}
              {tab === 'wordcloud' && '☁️ Word Cloud'}
              {tab === 'moments' && '🔥 Moments'}
              {tab === 'sentiment' && '😊 Sentiment'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      {timeline?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-indigo-400">{timeline.stats.totalMessages.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Messages total</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{timeline.stats.avgMessagesPerMin}</p>
            <p className="text-sm text-gray-500">Msg/min moyen</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{timeline.stats.peakMessages}</p>
            <p className="text-sm text-gray-500">Pic d'activité</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-pink-400">
              {correlation?.correlation != null ? `${correlation.correlation > 0 ? '+' : ''}${correlation.correlation}` : '—'}
            </p>
            <p className="text-sm text-gray-500">Corrélation viewers</p>
          </div>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Timeline chart */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
            <h2 className="font-semibold mb-4">📈 Activité du chat vs Viewers</h2>
            {timelineLoading ? (
              <Skeleton className="h-64" />
            ) : combinedData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={combinedData}>
                  <XAxis dataKey="minute" tickFormatter={formatMinute} stroke="#94a3b8" />
                  <YAxis yAxisId="left" stroke="#6366f1" />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                  <ReTooltip 
                    contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }}
                    labelFormatter={v => formatMinute(v as number)}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="messages" name="Messages" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="viewers" name="Viewers" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 py-12">Pas de données chat disponibles</div>
            )}
          </div>

          {/* Correlation insight */}
          {correlation?.insight && (
            <div className="bg-indigo-900/20 border border-indigo-800 rounded-lg p-4">
              <h3 className="font-semibold text-indigo-300 mb-2">💡 Analyse corrélation</h3>
              <p className="text-indigo-200">{correlation.insight}</p>
            </div>
          )}

          {/* Top moments preview */}
          {moments && moments.moments.length > 0 && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">🔥 Moments forts du chat</h2>
                <button onClick={() => setActiveTab('moments')} className="text-sm text-indigo-400 hover:underline">
                  Voir tout →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {moments.moments.slice(0, 3).map((m, i) => (
                  <div key={i} className="bg-gray-800/50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-amber-400 font-bold">{formatMinute(m.minute)}</span>
                      <span className="text-sm text-gray-400">{m.intensity}x la moyenne</span>
                    </div>
                    <p className="text-sm text-gray-300">{m.messages} messages</p>
                    {m.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.keywords.slice(0, 3).map(k => (
                          <span key={k} className="px-2 py-0.5 bg-gray-700 rounded text-xs">{k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'wordcloud' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                checked={includeEmotes} 
                onChange={e => setIncludeEmotes(e.target.checked)}
                className="rounded"
              />
              Inclure les emotes
            </label>
          </div>
          
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-6">
            <h2 className="font-semibold mb-4">☁️ Mots les plus utilisés</h2>
            {wordcloudLoading ? (
              <Skeleton className="h-64" />
            ) : wordcloud && wordcloud.words.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2 min-h-[200px]">
                {wordcloud.words.map((w, i) => {
                  // Taille basée sur le poids (10-48px)
                  const fontSize = Math.max(12, Math.min(48, 12 + (w.weight / 100) * 36));
                  // Couleur basée sur l'index
                  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
                  const color = colors[i % colors.length];
                  // Opacité basée sur le rang
                  const opacity = Math.max(0.5, 1 - (i / wordcloud.words.length) * 0.5);
                  
                  return (
                    <span
                      key={w.word}
                      className="inline-block transition-transform hover:scale-110 cursor-default"
                      style={{ fontSize: `${fontSize}px`, color, opacity }}
                      title={`${w.word}: ${w.count} fois`}
                    >
                      {w.word}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">Pas assez de messages pour générer un word cloud</div>
            )}
            {wordcloud && (
              <p className="text-center text-sm text-gray-500 mt-4">
                Basé sur {wordcloud.totalMessages.toLocaleString()} messages analysés
              </p>
            )}
          </div>

          {/* Top words list */}
          {wordcloud && wordcloud.words.length > 0 && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
              <h3 className="font-semibold mb-3">📊 Top 20 mots</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {wordcloud.words.slice(0, 20).map((w, i) => (
                  <div key={w.word} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-2">
                    <span className="text-gray-300 truncate">
                      <span className="text-gray-500 mr-2">{i + 1}.</span>
                      {w.word}
                    </span>
                    <span className="text-indigo-400 font-mono text-sm">{w.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'moments' && (
        <div className="space-y-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
            <h2 className="font-semibold mb-4">🔥 Tous les moments forts ({moments?.moments.length || 0})</h2>
            {momentsLoading ? (
              <Skeleton className="h-64" />
            ) : moments && moments.moments.length > 0 ? (
              <div className="space-y-3">
                {moments.moments.map((m, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-shrink-0 w-24">
                      <div className="text-xl font-bold text-amber-400">{formatMinute(m.minute)}</div>
                      <div className="text-xs text-gray-500">{m.duration} min de pic</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-lg font-semibold">{m.messages} messages</span>
                        <span className={`px-2 py-0.5 rounded text-sm ${
                          m.intensity >= 3 ? 'bg-red-900/50 text-red-300' :
                          m.intensity >= 2 ? 'bg-amber-900/50 text-amber-300' :
                          'bg-emerald-900/50 text-emerald-300'
                        }`}>
                          {m.intensity}x la moyenne
                        </span>
                      </div>
                      {m.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-gray-500 mr-2">Mots-clés:</span>
                          {m.keywords.map(k => (
                            <span key={k} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{k}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link 
                      href={`/history/${streamId}?t=${m.minute}`}
                      className="text-indigo-400 hover:text-indigo-300 text-sm"
                    >
                      Voir le replay →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                Aucun moment fort détecté (seuil: {moments?.threshold}x la moyenne)
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sentiment' && (
        <div className="space-y-6">
          {/* Summary cards */}
          {sentiment?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{sentiment.summary.positivePercent}%</p>
                <p className="text-sm text-gray-400">Positif ({sentiment.summary.positive})</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-400">
                  {100 - sentiment.summary.positivePercent - sentiment.summary.negativePercent}%
                </p>
                <p className="text-sm text-gray-500">Neutre ({sentiment.summary.neutral})</p>
              </div>
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{sentiment.summary.negativePercent}%</p>
                <p className="text-sm text-gray-400">Négatif ({sentiment.summary.negative})</p>
              </div>
              <div className={`border rounded-lg p-4 text-center ${
                sentiment.summary.score >= 20 ? 'bg-emerald-900/20 border-emerald-800' :
                sentiment.summary.score <= -20 ? 'bg-red-900/20 border-red-800' :
                'bg-gray-800/50 border-gray-700'
              }`}>
                <p className={`text-2xl font-bold ${
                  sentiment.summary.score >= 20 ? 'text-emerald-400' :
                  sentiment.summary.score <= -20 ? 'text-red-400' :
                  'text-gray-300'
                }`}>
                  {sentiment.summary.score >= 0 ? '+' : ''}{sentiment.summary.score}
                </p>
                <p className="text-sm text-gray-400">Score global</p>
              </div>
            </div>
          )}

          {/* Sentiment timeline */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
            <h2 className="font-semibold mb-4">📈 Évolution du sentiment</h2>
            {sentimentLoading ? (
              <Skeleton className="h-64" />
            ) : sentiment && sentiment.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={sentiment.timeline}>
                  <XAxis dataKey="minute" tickFormatter={formatMinute} stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <ReTooltip 
                    contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }}
                    labelFormatter={v => formatMinute(v as number)}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="positive" name="Positif" stackId="1" fill={SENTIMENT_COLORS.positive} stroke={SENTIMENT_COLORS.positive} />
                  <Area type="monotone" dataKey="neutral" name="Neutre" stackId="1" fill={SENTIMENT_COLORS.neutral} stroke={SENTIMENT_COLORS.neutral} />
                  <Area type="monotone" dataKey="negative" name="Négatif" stackId="1" fill={SENTIMENT_COLORS.negative} stroke={SENTIMENT_COLORS.negative} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 py-12">Pas de données de sentiment</div>
            )}
          </div>

          {/* Hype & Toxic moments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hype moments */}
            <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-4">
              <h3 className="font-semibold text-emerald-300 mb-3">🎉 Moments hype</h3>
              {sentiment?.hypeMoments && sentiment.hypeMoments.length > 0 ? (
                <div className="space-y-2">
                  {sentiment.hypeMoments.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-emerald-900/30 rounded p-2">
                      <span className="text-emerald-200">{formatMinute(m.minute)}</span>
                      <span className="text-emerald-400 font-semibold">+{m.score}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-emerald-300/50 text-sm">Aucun moment particulièrement hype détecté</p>
              )}
            </div>

            {/* Toxic moments */}
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <h3 className="font-semibold text-red-300 mb-3">⚠️ Moments négatifs</h3>
              {sentiment?.toxicMoments && sentiment.toxicMoments.length > 0 ? (
                <div className="space-y-2">
                  {sentiment.toxicMoments.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-red-900/30 rounded p-2">
                      <span className="text-red-200">{formatMinute(m.minute)}</span>
                      <span className="text-red-400 font-semibold">{m.score}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-red-300/50 text-sm">Aucun moment particulièrement négatif 👍</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
