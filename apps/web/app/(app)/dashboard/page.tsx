"use client";
import useSWR from 'swr';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Tooltip } from '../../../components/Tooltip';
import { Skeleton } from '../../../components/Skeleton';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../../components/Toast';
import { Adsense } from '../../../components/Adsense';

import { API_BASE, fetchJSON, LastStreamResponse, SessionResponse, TwitchStreamResponse, MeResponse, Goal, GoalProgress } from '../../../lib/api';

export default function DashboardPage() {
  const { show } = useToast();
  const { data: session, error: sessionErr, isLoading: sessionLoading } = useSWR<SessionResponse>(`${API_BASE}/auth/session`, fetchJSON);
  const { data: me, error: meErr, isLoading: meLoading } = useSWR<MeResponse>(session?.authenticated ? `${API_BASE}/api/me` : null, fetchJSON);
  const { data: last, error: lastErr, isLoading: lastLoading } = useSWR<LastStreamResponse>(session?.authenticated ? `${API_BASE}/api/twitch/last-stream` : null, fetchJSON);
  const { data: stream, error: streamErr, isLoading: streamLoading } = useSWR<TwitchStreamResponse>(session?.authenticated ? `${API_BASE}/api/twitch/stream` : null, fetchJSON, { refreshInterval: 15000 });
  const [liveViewers, setLiveViewers] = useState<number | null>(null);
  const [liveSeries, setLiveSeries] = useState<{ t: number; viewers: number }[]>([]);
  const [liveChat, setLiveChat] = useState<{ t: number; messages: number }[]>([]);
  const [liveMoments, setLiveMoments] = useState<number[]>([]); // timestamps ms pour clip.suggested
  const [showLiveChat, setShowLiveChat] = useState<boolean>(true);
  const [showLiveClips, setShowLiveClips] = useState<boolean>(true);
  const [range, setRange] = useState<'7d' | '30d' | 'custom' | 'yesterday' | 'lastWeek' | 'thisMonth'>('7d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const customError = useMemo(() => {
    if (!customFrom || !customTo) return false;
    const f = new Date(customFrom).getTime();
    const t = new Date(customTo).getTime();
    return Number.isFinite(f) && Number.isFinite(t) && f > t;
  }, [customFrom, customTo]);
  const [showUTC, setShowUTC] = useState(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
  const disconnectSinceRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const esRef = useRef<EventSource | null>(null);

  // Charger/sauver les préférences de période
  useEffect(() => {
    try {
      const r = localStorage.getItem('dashRange') as typeof range | null;
      const cf = localStorage.getItem('dashFrom');
      const ct = localStorage.getItem('dashTo');
      const tz = localStorage.getItem('dashShowUTC');
      if (r) setRange(r);
      if (cf) setCustomFrom(cf);
      if (ct) setCustomTo(ct);
      if (tz) setShowUTC(tz === '1');
      const slc = localStorage.getItem('liveShowClips');
      const slm = localStorage.getItem('liveShowChat');
      if (slc) setShowLiveClips(slc === '1');
      if (slm) setShowLiveChat(slm === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('dashRange', range); } catch {}
  }, [range]);
  useEffect(() => {
    try {
      if (customFrom) localStorage.setItem('dashFrom', customFrom); else localStorage.removeItem('dashFrom');
      if (customTo) localStorage.setItem('dashTo', customTo); else localStorage.removeItem('dashTo');
    } catch {}
  }, [customFrom, customTo]);
  useEffect(() => {
    try { localStorage.setItem('dashShowUTC', showUTC ? '1' : '0'); } catch {}
  }, [showUTC]);
  useEffect(() => { try { localStorage.setItem('liveShowClips', showLiveClips ? '1' : '0'); } catch {} }, [showLiveClips]);
  useEffect(() => { try { localStorage.setItem('liveShowChat', showLiveChat ? '1' : '0'); } catch {} }, [showLiveChat]);

  const rangeParams = useMemo(() => {
    const padEnd = (d: Date) => new Date(d.getTime() - 1); // pour inclure la fin exclusive si besoin
    if (range === 'custom') {
      if (customFrom && customTo) {
        // Validation: Du ne doit pas être après Au
        const f = new Date(customFrom);
        const t = new Date(customTo);
        if (f.getTime() > t.getTime()) return null;
        return `from=${encodeURIComponent(new Date(customFrom).toISOString())}&to=${encodeURIComponent(new Date(customTo).toISOString())}`;
      }
      return null; // bloque la requête tant que incomplet
    }
    const now = new Date();
    let from: Date;
    let to: Date;
    if (range === '7d') {
      to = now;
      from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    } else if (range === '30d') {
      to = now;
      from = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    } else if (range === 'yesterday') {
      const end = new Date(); end.setHours(0,0,0,0); // aujourd’hui 00:00
      const start = new Date(end); start.setDate(end.getDate() - 1); // hier 00:00
      from = start; to = padEnd(end);
    } else if (range === 'lastWeek') {
      const today = new Date();
      const day = today.getDay() || 7; // 1..7 (lundi=1)
      const thisWeekStart = new Date(today); thisWeekStart.setHours(0,0,0,0); thisWeekStart.setDate(today.getDate() - (day - 1));
      const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(thisWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);
      from = lastWeekStart; to = padEnd(lastWeekEnd);
    } else { // thisMonth
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      from = start; to = now;
    }
    return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
  }, [range, customFrom, customTo]);

  type Summary = { range: { from: string; to: string }; totalStreams: number; totalDurationMinutes: number; peakViewers: number; avgViewers: number; newFollowers: number };
  const summaryKey = useMemo(() => {
    if (!session?.authenticated) return null;
    if (!rangeParams) return null;
    return `${API_BASE}/api/analytics/summary?${rangeParams}`;
  }, [session?.authenticated, rangeParams]);
  const { data: summary, error: sumErr, isLoading: sumLoading } = useSWR<Summary>(summaryKey, fetchJSON);
  type Heatmap = { range: { from: string; to: string }; cells: { dow: number; hour: number; avgViewers: number; followerCount: number; count: number }[]; maxAvgViewers: number; maxFollowerCount: number; labels: { days: string[]; hours: number[] } };
  const heatKey = useMemo(() => {
    if (!session?.authenticated) return null;
    if (!rangeParams) return null;
    return `${API_BASE}/api/analytics/heatmap?${rangeParams}`;
  }, [session?.authenticated, rangeParams]);
  const { data: heatmap } = useSWR<Heatmap>(heatKey, fetchJSON);
  type ConversionItem = { streamId: number; title: string | null; category: string | null; startedAt: string; endedAt: string | null; durationMinutes: number; followers: number; ratePerHour: number };
  type ConversionResp = { range: { from: string; to: string }; items: ConversionItem[]; totals: { followers: number; durationMinutes: number; ratePerHour: number } };
  const convKey = useMemo(() => {
    if (!session?.authenticated) return null;
    if (!rangeParams) return null;
    return `${API_BASE}/api/analytics/conversion?${rangeParams}`;
  }, [session?.authenticated, rangeParams]);
  const { data: conversion } = useSWR<ConversionResp>(convKey, fetchJSON);

  // Goals data
  const goalsKey = session?.authenticated ? `${API_BASE}/api/goals` : null;
  const { data: goals, mutate: mutateGoals } = useSWR<Goal[]>(goalsKey, fetchJSON);
  const progKey = session?.authenticated ? `${API_BASE}/api/goals/progress` : null;
  const { data: goalsProg, mutate: mutateProg } = useSWR<GoalProgress[]>(progKey, fetchJSON, { refreshInterval: 30000 });
  const [heatMode, setHeatMode] = useState<'viewers'|'followers'>('viewers');
  const [heatScale, setHeatScale] = useState<'global'|'row'>('global');
  const [heatLiveOnly, setHeatLiveOnly] = useState<boolean>(false);

  // Persistance des préférences heatmap
  useEffect(() => {
    try {
      const m = localStorage.getItem('heatMode');
      const s = localStorage.getItem('heatScale');
      const l = localStorage.getItem('heatLiveOnly');
      if (m === 'viewers' || m === 'followers') setHeatMode(m);
      if (s === 'global' || s === 'row') setHeatScale(s);
      if (l === '1' || l === '0') setHeatLiveOnly(l === '1');
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('heatMode', heatMode); } catch {} }, [heatMode]);
  useEffect(() => { try { localStorage.setItem('heatScale', heatScale); } catch {} }, [heatScale]);
  useEffect(() => { try { localStorage.setItem('heatLiveOnly', heatLiveOnly ? '1' : '0'); } catch {} }, [heatLiveOnly]);
  
  const anyError = sessionErr || meErr || lastErr || streamErr;

  useEffect(() => {
    if (anyError) {
      show('Erreur lors du chargement des données.', 'error');
    }
  }, [anyError, show]);

  useEffect(() => {
    if (!session?.authenticated) return;
    let stopped = false;
    const MAX_DELAY = 30000; // 30s max backoff
    const TOAST_AFTER_MS = 10000; // N s avant toast
    const connect = (delay = 1000) => {
      if (stopped) return;
      if (esRef.current) { try { esRef.current.close(); } catch {} }
      const es = new EventSource(`${API_BASE}/api/events`, { withCredentials: true } as any);
      esRef.current = es;
      es.onopen = () => {
        setSseConnected(true);
        disconnectSinceRef.current = null;
        setLastHeartbeat(Date.now());
      };
      es.onerror = () => {
        setSseConnected(false);
        if (!disconnectSinceRef.current) disconnectSinceRef.current = Date.now();
        const since = Date.now() - (disconnectSinceRef.current || Date.now());
        if (since > TOAST_AFTER_MS) {
          show("Connexion temps réel perdue, tentative de reconnexion…", 'warning');
        }
        const next = Math.min(delay * 2, MAX_DELAY);
        try { es.close(); } catch {}
        reconnectTimerRef.current = setTimeout(() => connect(next), delay);
      };
      es.addEventListener('heartbeat', () => setLastHeartbeat(Date.now()));
      es.addEventListener('viewers.update', (ev: MessageEvent) => {
        try {
          const p = JSON.parse(ev.data);
          if (typeof p.viewers === 'number') {
            setLiveViewers(p.viewers);
            const at = typeof p.at === 'number' ? p.at : Date.now();
            setLiveSeries(prev => {
              const cutoff = Date.now() - 15 * 60 * 1000;
              const next = [...prev, { t: at, viewers: p.viewers }].filter(pt => pt.t >= cutoff);
              return next;
            });
          }
        } catch {}
      });
      es.addEventListener('chat.activity', (ev: MessageEvent) => {
        try {
          const p = JSON.parse(ev.data);
          if (typeof p.messages === 'number') {
            const at = typeof p.at === 'number' ? p.at : Date.now();
            setLiveChat(prev => {
              const cutoff = Date.now() - 15 * 60 * 1000;
              const next = [...prev, { t: at, messages: p.messages }].filter(pt => pt.t >= cutoff);
              return next;
            });
          }
        } catch {}
      });
      es.addEventListener('clip.suggested', (ev: MessageEvent) => {
        try {
          const p = JSON.parse(ev.data);
          const at = typeof p.at === 'number' ? p.at : Date.now();
          setLiveMoments(prev => {
            const cutoff = Date.now() - 15 * 60 * 1000;
            const next = [...prev, at].filter(ts => ts >= cutoff);
            return next;
          });
        } catch {}
      });
      es.addEventListener('follower.new', (ev: MessageEvent) => {
        try { const p = JSON.parse(ev.data); show(`Nouveau follower: ${p.name || p.login || 'inconnu'}`, 'success'); } catch {}
      });
      es.addEventListener('stream.offline', () => { setLiveViewers(null); setLiveSeries([]); });
    };
    connect();
    const hbInterval = setInterval(() => {
      if (lastHeartbeat && Date.now() - lastHeartbeat > 30000) {
        setSseConnected(false);
      }
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(hbInterval);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (esRef.current) { try { esRef.current.close(); } catch {} }
    };
  }, [session?.authenticated, show, lastHeartbeat]);

  const series = last?.series?.map((p: any) => ({
    time: new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    viewers: p.viewers,
  })) ?? [];

  const liveChartData = useMemo(() => liveSeries.map(p => ({
    time: new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    viewers: p.viewers,
  })), [liveSeries]);

  // Fusion viewers + messages/min par timestamp (dernier connu) pour affichage multi-axes
  const liveCombined = useMemo(() => {
    const times = new Set<number>();
    for (const p of liveSeries) times.add(p.t);
    for (const p of liveChat) times.add(p.t);
    const sorted = Array.from(times).sort((a,b)=>a-b);
    let lastV: number | null = null;
    let lastM: number | null = null;
    const vByT = new Map(liveSeries.map(p=>[p.t, p.viewers] as const));
    const mByT = new Map(liveChat.map(p=>[p.t, p.messages] as const));
    return sorted.map(t => {
      const v = vByT.has(t) ? vByT.get(t)! : lastV;
      const m = mByT.has(t) ? mByT.get(t)! : lastM;
      lastV = v ?? lastV; lastM = m ?? lastM;
      return {
        time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        viewers: v ?? null,
        messages: m ?? null,
      };
    });
  }, [liveSeries, liveChat]);

  const liveClipTimesStr = useMemo(() => liveMoments.map(ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), [liveMoments]);

  // Moments à clipper du dernier stream
  const lastClipKey = session?.authenticated ? `${API_BASE}/api/streams/last/clip-moments` : null;
  const { data: lastClips } = useSWR<{ items: { at: string; label?: string | null; score?: number }[] }>(lastClipKey, fetchJSON);
  // Clips créés (persistés) — dernier stream

  // Projeter les moments sur l’échelle X	
  const lastClipTimes = useMemo(()=>{
    if (!last?.series || !lastClips?.items) return [] as number[];
    return lastClips.items.map(m => new Date(m.at).getTime());
  }, [last?.series, lastClips]);

  // Liste des clips créés sur le dernier stream
  const { data: createdClips } = useSWR<{ items: { twitchClipId: string; url?: string | null; editUrl?: string | null; confirmed: boolean; createdAt: string }[] }>(
    session?.authenticated ? `${API_BASE}/api/streams/last/clips` : null,
    fetchJSON
  );

  // Deltas période-sur-période
  const prevKey = useMemo(() => {
    if (!summary) return null;
    const from = new Date(summary.range.from).getTime();
    const to = new Date(summary.range.to).getTime();
    const duration = Math.max(0, to - from);
    if (!duration) return null;
    const prevFrom = new Date(from - duration).toISOString();
    const prevTo = new Date(from).toISOString();
    return `${API_BASE}/api/analytics/summary?from=${encodeURIComponent(prevFrom)}&to=${encodeURIComponent(prevTo)}`;
  }, [summary]);
  const { data: prevSummary } = useSWR<Summary>(prevKey, fetchJSON);

  function computeDelta(curr?: number, prev?: number) {
    if (typeof curr !== 'number' || typeof prev !== 'number') return null;
    const diff = curr - prev;
    const pct = prev === 0 ? (curr > 0 ? 100 : 0) : (diff / prev) * 100;
    return { diff, pct };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {sessionLoading && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
      )}
      {anyError && (<div className="text-red-400">Une erreur est survenue lors du chargement des données.</div>)}

      {session?.authenticated ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <MotionCard className="col-span-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="text-sm text-gray-400">Période</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button onClick={() => setRange('7d')} className={`px-3 py-1 rounded border ${range==='7d'?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>7 jours</button>
                  <button onClick={() => setRange('30d')} className={`px-3 py-1 rounded border ${range==='30d'?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>30 jours</button>
                  <button onClick={() => setRange('yesterday')} className={`px-3 py-1 rounded border ${range==='yesterday'?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>Hier</button>
                  <button onClick={() => setRange('lastWeek')} className={`px-3 py-1 rounded border ${range==='lastWeek'?'border-[var(--brand)] text-[var(--brand)]':'border-default text-muted'}`}>Semaine dernière</button>
                  <button onClick={() => setRange('thisMonth')} className={`px-3 py-1 rounded border ${range==='thisMonth'?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>Ce mois-ci</button>
                  <button onClick={() => setRange('custom')} className={`px-3 py-1 rounded border ${range==='custom'?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>Personnalisé</button>
                </div>
              </div>
              {range === 'custom' && (
                <div className="flex items-end gap-2">
                  <div>
                    <div className="text-sm text-gray-400">Du</div>
                    <input type="datetime-local" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="bg-gray-950 border border-gray-800 rounded px-2 py-1" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Au</div>
                    <input type="datetime-local" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="bg-gray-950 border border-gray-800 rounded px-2 py-1" />
                  </div>
                  <button
                    onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                    className="ml-2 px-3 py-1 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700"
                    title="Effacer la période personnalisée"
                  >Effacer</button>
                </div>
              )}
              {range === 'custom' && customError && (
                <div className="text-xs text-rose-400">La date de début doit être antérieure à la date de fin.</div>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setShowUTC(v=>!v)} className="text-xs px-2 py-1 rounded border border-gray-800 text-gray-300 bg-gray-900/50">{showUTC ? 'UTC' : 'Local'}</button>
                {summary && (
                  <div className="text-xs px-2 py-1 rounded border border-gray-800 text-gray-300 bg-gray-900/50">
                    Du {formatStamp(summary.range.from, showUTC)} au {formatStamp(summary.range.to, showUTC)} ({showUTC ? 'UTC' : 'local'})
                  </div>
                )}
              </div>
            </div>
          </MotionCard>

          <MotionCard className="col-span-3">
            {sumLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Skeleton variant="card" className="h-20" />
                <Skeleton variant="card" className="h-20" />
                <Skeleton variant="card" className="h-20" />
                <Skeleton variant="card" className="h-20" />
                <Skeleton variant="card" className="h-20" />
              </div>
            ) : sumErr ? (
              <div className="text-red-400">Impossible de charger le résumé de la période.</div>
            ) : summary ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard title="Streams" value={summary.totalStreams} delta={computeDelta(summary.totalStreams, prevSummary?.totalStreams || 0)} />
                <StatCard title="Durée" value={`${summary.totalDurationMinutes} min`} delta={computeDelta(summary.totalDurationMinutes, prevSummary?.totalDurationMinutes || 0)} />
                <StatCard title="Pic global" value={summary.peakViewers} delta={computeDelta(summary.peakViewers, prevSummary?.peakViewers || 0)} />
                <StatCard title="Moyenne" value={summary.avgViewers} delta={computeDelta(summary.avgViewers, prevSummary?.avgViewers || 0)} />
                <StatCard title="Followers" value={summary.newFollowers} delta={computeDelta(summary.newFollowers, prevSummary?.newFollowers || 0)} />
              </div>
            ) : null}
          </MotionCard>
          <MotionCard className="col-span-1">
            <h2 className="font-medium mb-3">
              <Tooltip content="Infos de base de votre compte Twitch">
                <span>Profil</span>
              </Tooltip>
            </h2>
            {meLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" className="w-12 h-12" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ) : me ? (
              <div className="flex items-center gap-3">
                {me.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.profileImageUrl} alt="avatar" className="w-12 h-12 rounded-full" />
                ) : null}
                <div>
                  <div className="font-semibold">{me.displayName || me.login}</div>
                  <div className="text-sm text-gray-400">@{me.login}</div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">Profil indisponible</div>
            )}
          </MotionCard>

          <MotionCard className="col-span-2">
            <h2 className="font-medium mb-3">
              <Tooltip content="Si vous êtes en live, les données sont actualisées toutes les 15s">
                <span>Statistiques en temps réel</span>
              </Tooltip>
            </h2>
            <div className="mb-2 text-xs">
              Connexion temps réel: {sseConnected ? <span className="text-green-400">connectée</span> : <span className="text-yellow-400">déconnectée</span>}
              {lastHeartbeat && !sseConnected ? <span className="text-gray-400"> (dernier heartbeat {Math.floor((Date.now() - lastHeartbeat)/1000)}s)</span> : null}
            </div>
            {streamLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton variant="card" className="h-20" />
                <Skeleton variant="card" className="h-20" />
                <Skeleton variant="card" className="h-20" />
              </div>
            ) : (stream && stream.data && stream.data.length > 0) ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Viewers" value={liveViewers ?? stream.data[0].viewer_count} />
                <StatCard title="Catégorie" value={stream.data[0].game_name || '—'} />
                <StatCard title="Uptime" value={formatUptime(stream.data[0].started_at)} />
              </div>
            ) : (
              <div className="text-gray-400">Hors ligne</div>
            )}
          </MotionCard>

          <MotionCard className="col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Heatmap horaires</h2>
              <div className="flex gap-2 text-sm">
                <button onClick={() => setHeatMode('viewers')} className={`px-2 py-1 rounded border ${heatMode==='viewers'?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>Viewers</button>
                <button onClick={() => setHeatMode('followers')} className={`px-2 py-1 rounded border ${heatMode==='followers'?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>Followers</button>
                <span className="mx-2 h-5 w-px bg-gray-800" />
                <button onClick={() => setHeatScale('global')} className={`px-2 py-1 rounded border ${heatScale==='global'?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>Échelle globale</button>
                <button onClick={() => setHeatScale('row')} className={`px-2 py-1 rounded border ${heatScale==='row'?'border-indigo-500 text-indigo-300':'border-gray-800 text-gray-300'}`}>Échelle par jour</button>
                <span className="mx-2 h-5 w-px bg-gray-800" />
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={heatLiveOnly} onChange={e=>setHeatLiveOnly(e.target.checked)} className="accent-brand" />
                  <span>Uniquement heures en live</span>
                </label>
              </div>
            </div>
            {heatmap ? (
              <div className="overflow-auto">
                <div className="min-w-[760px]">
                  {/* Légende */}
                  <div className="flex items-center justify-end gap-2 mb-2 text-xs text-gray-400">
                    <span>faible</span>
                    <div className="h-2 w-40 rounded" style={{ background: heatMode==='viewers' ? 'linear-gradient(90deg, rgba(34,211,238,0.1), rgba(34,211,238,0.85))' : 'linear-gradient(90deg, rgba(249,115,22,0.1), rgba(249,115,22,0.85))' }} />
                    <span>fort</span>
                  </div>
                  <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-1">
                    <div></div>
                    {heatmap.labels.hours.map((h) => (
                      <div key={`h-${h}`} className="text-xs text-gray-400 text-center">{h}</div>
                    ))}
                    {heatmap.labels.days.map((d, rowIdx) => {
                      // max par ligne si mode row
                      const rowCells = heatmap.cells.filter(c=>c.dow===rowIdx);
                      const rowMax = heatScale==='row' ? (
                        heatMode==='viewers'
                          ? Math.max(1, ...rowCells.filter(c=>!heatLiveOnly || c.count>0).map(c=>c.avgViewers))
                          : Math.max(1, ...rowCells.filter(c=>!heatLiveOnly || c.count>0).map(c=>c.followerCount))
                      ) : 1;
                      return ([
                        <div key={`label-${rowIdx}`} className="text-xs text-gray-400 flex items-center">{d}</div>,
                        ...heatmap.labels.hours.map((h) => {
                          const cell = heatmap.cells.find(c => c.dow === rowIdx && c.hour === h);
                          const isLive = (cell?.count ?? 0) > 0;
                          const baseVal = heatMode==='viewers' ? (cell?.avgViewers ?? 0) : (cell?.followerCount ?? 0);
                          const val = heatLiveOnly ? (isLive ? baseVal : 0) : baseVal;
                          const maxGlobal = heatMode==='viewers' ? (heatmap.maxAvgViewers || 1) : (heatmap.maxFollowerCount || 1);
                          const denom = heatScale==='row' ? rowMax : (maxGlobal || 1);
                          const pct = denom > 0 ? Math.min(1, val / denom) : 0;
                          const bg = heatMode==='viewers' ? `rgba(34,211,238,${pct*0.85})` : `rgba(249,115,22,${pct*0.85})`;
                          const labelDay = heatmap.labels.days[rowIdx];
                          const title = `${labelDay} ${String(h).padStart(2,'0')}:00\n${heatMode==='viewers' ? `${val} avg viewers` : `${val} followers`}${cell?.count ? `\n${cell.count} points` : ''}`;
                          const style: React.CSSProperties = { background: pct>0 ? bg : 'transparent', opacity: !heatLiveOnly || isLive ? 1 : 0.2 };
                          return (
                            <div key={`c-${rowIdx}-${h}`} className="h-6 rounded border border-gray-800" style={style} title={title}></div>
                          );
                        })
                      ]);
                    })}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {heatScale==='row' ? 'Échelle par jour: chaque ligne est normalisée sur son propre maximum' : 'Échelle globale: toutes les cellules sont normalisées sur le maximum global'}.
                    {heatLiveOnly ? ' (Filtre actif: seules les heures avec données live influencent les couleurs.)' : ''}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="h-3 w-28 skeleton rounded animate-pulse" />
                  <div className="h-3 w-40 skeleton rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-1">
                  <div className="h-4 bg-gray-800/40 rounded" />
                  {Array.from({length:24}).map((_,i)=>(<div key={i} className="h-4 bg-gray-800/40 rounded" />))}
                  {Array.from({length:7}).map((_,r)=>([
                    <div key={`l${r}`} className="h-6 bg-gray-800/30 rounded" />,
                    ...Array.from({length:24}).map((_,c)=>(<div key={`c${r}-${c}`} className="h-6 bg-gray-900/40 rounded" />))
                  ]))}
                </div>
              </div>
            )}
          </MotionCard>

          <MotionCard className="col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Objectifs</h2>
            </div>
            <GoalsWidget goals={goals || []} progress={goalsProg || []} onChanged={() => { mutateGoals(); mutateProg(); }} />
          </MotionCard>

          <MotionCard className="col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Conversion followers par stream</h2>
              {conversion && (
                <div className="text-xs text-gray-400">
                  Total: {conversion.totals.followers} fols • {conversion.totals.durationMinutes} min • {conversion.totals.ratePerHour}/h
                </div>
              )}
            </div>
            {!conversion ? (
              <div className="space-y-2">
                <Skeleton variant="card" className="h-10" />
                <Skeleton variant="card" className="h-10" />
                <Skeleton variant="card" className="h-10" />
              </div>
            ) : conversion.items.length === 0 ? (
              <div className="text-gray-400">Aucun stream dans la période.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <th className="py-2 pr-4">Titre</th>
                      <th className="py-2 pr-4">Catégorie</th>
                      <th className="py-2 pr-4">Début</th>
                      <th className="py-2 pr-4 text-right">Durée</th>
                      <th className="py-2 pr-4 text-right">Followers</th>
                      <th className="py-2 pr-4 text-right">/h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversion.items.map((it) => (
                      <tr key={it.streamId} className="border-t border-gray-800 hover:bg-gray-900/50">
                        <td className="py-2 pr-4">
                          <Link href={`/history/${it.streamId}`} className="text-indigo-300 hover:underline">
                            {it.title || 'Sans titre'}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">{it.category || '—'}</td>
                        <td className="py-2 pr-4">{new Date(it.startedAt).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-right">{it.durationMinutes} min</td>
                        <td className="py-2 pr-4 text-right">{it.followers}</td>
                        <td className="py-2 pr-4 text-right">{it.ratePerHour}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </MotionCard>

          <MotionCard className="col-span-3">
            <h2 className="font-medium mb-3">
              <Tooltip content="Vue concentrée sur les 15 dernières minutes, alimentée par SSE">
                <span>Viewers en direct (15 min)</span>
              </Tooltip>
            </h2>
            <div className="flex items-center gap-3 mb-2 text-sm text-gray-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-brand" checked={showLiveChat} onChange={e=>setShowLiveChat(e.target.checked)} />
                Messages/min
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-brand" checked={showLiveClips} onChange={e=>setShowLiveClips(e.target.checked)} />
                Overlay clips
              </label>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveCombined}>
                  <XAxis dataKey="time" stroke="#94a3b8" />
                  <YAxis yAxisId="viewers" stroke="#94a3b8" allowDecimals={false} />
                  {showLiveChat && (<YAxis yAxisId="chat" orientation="right" stroke="#f59e0b" allowDecimals={false} />)}
                  <ReTooltip contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }} />
                  {/* Overlay: moments à clipper (fenêtre 15min live) */}
                  {showLiveClips && liveClipTimesStr.map((x, i) => (
                    <ReferenceLine key={i} x={x} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: 'Clip', fill: '#f59e0b' }} />
                  ))}
                  <Line yAxisId="viewers" type="monotone" dataKey="viewers" stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls />
                  {showLiveChat && (<Line yAxisId="chat" type="monotone" dataKey="messages" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </MotionCard>

          <MotionCard className="col-span-2">
            <h2 className="font-medium mb-3">
              <Tooltip content="Courbe des viewers mesurée pendant votre dernier live">
                <span>Évolution des viewers (dernier stream)</span>
              </Tooltip>
            </h2>
            <div className="h-64">
              {lastLoading ? (
                <Skeleton variant="card" className="h-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <XAxis dataKey="time" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <ReTooltip contentStyle={{ background: '#0b0f14', border: '1px solid #1f2937' }} />
                    {/* Overlay: lignes verticales pour moments à clipper */}
                    {lastClipTimes.map((ts, i) => {
                      const label = new Date(ts).toLocaleTimeString();
                      // Recharts ReferenceLine pour marquer l’instant; ici on n’a pas directement la clé X (string time) alignée, on précise position via xAxisId ? Simplif: afficher sous forme d’une Line supplémentaire nulle n’est pas idéal.
                      // On ajoutera un petit hack: montrer une tooltip d’aide via une fine série.
                      return <ReferenceLine key={i} x={new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: 'Clip', fill: '#f59e0b' }} />;
                    })}
                    <Line type="monotone" dataKey="viewers" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </MotionCard>

          <div className="col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
            {lastLoading ? (
              <>
                <Skeleton variant="card" className="h-20" />
                <Skeleton variant="card" className="h-20" />
                <Skeleton variant="card" className="h-20" />
                <Skeleton variant="card" className="h-20" />
              </>
            ) : (
              <>
                <StatCard title="Durée" value={`${last?.summary?.durationMinutes ?? '—'} min`} />
                <StatCard title="Pic viewers" value={last?.summary?.peakViewers ?? '—'} />
                <StatCard title="Moy. viewers" value={last?.summary?.avgViewers ?? '—'} />
                <StatCard title="Nouveaux followers" value={last?.summary?.newFollowers ?? '—'} />
              </>
            )}
          </div>

          {/* Clips créés pendant le dernier stream */}
          <MotionCard className="col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Clips créés (dernier stream)</h2>
            </div>
            {!createdClips ? (
              <div className="space-y-2">
                <Skeleton variant="card" className="h-10" />
                <Skeleton variant="card" className="h-10" />
              </div>
            ) : createdClips.items.length === 0 ? (
              <div className="text-gray-400">Aucun clip créé via Statisfaction.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <th className="py-2 pr-4">Clip ID</th>
                      <th className="py-2 pr-4">Lien</th>
                      <th className="py-2 pr-4">Confirmé</th>
                      <th className="py-2 pr-4">Créé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {createdClips.items.map((c) => (
                      <tr key={c.twitchClipId} className="border-t border-gray-800">
                        <td className="py-2 pr-4">{c.twitchClipId}</td>
                        <td className="py-2 pr-4">
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline">Ouvrir</a>
                          ) : c.editUrl ? (
                            <a href={c.editUrl} target="_blank" rel="noreferrer" className="text-amber-300 hover:underline">Éditer</a>
                          ) : '—'}
                        </td>
                        <td className="py-2 pr-4">{c.confirmed ? 'Oui' : 'Non'}</td>
                        <td className="py-2 pr-4">{new Date(c.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </MotionCard>
        </div>
      ) : (
        <div className="text-gray-400">Veuillez vous connecter pour voir votre dashboard.</div>
      )}
    </div>
  );
}

function StatCard({ title, value, delta }: { title: string; value: string | number; delta?: { diff: number; pct: number } | null }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded p-4 transition-transform duration-300 hover:scale-[1.01]">
      <div className="text-sm text-gray-400">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
      {delta ? (
        <div className={`text-xs mt-1 ${delta.diff > 0 ? 'text-emerald-400' : delta.diff < 0 ? 'text-rose-400' : 'text-gray-400'}`}>
          {delta.diff > 0 ? '↑' : delta.diff < 0 ? '↓' : '→'} {Math.abs(delta.pct).toFixed(1)}%
        </div>
      ) : null}

      {/* Publicité non intrusive en bas de page */}
      <div className="pt-8">
        <Adsense slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEATURES_MID} />
      </div>
    </div>
  );
}

function formatUptime(startedAt?: string) {
  if (!startedAt) return '—';
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return '—';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function formatStamp(iso: string, utc: boolean) {
  const d = new Date(iso);
  if (utc) {
    // Format simple en UTC
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${y}-${mo}-${da} ${hh}:${mi} UTC`;
  }
  return d.toLocaleString();
}

import { motion } from 'framer-motion';
function MotionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={`bg-gray-900/60 border border-gray-800 rounded p-4 ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

function GoalsWidget({ goals, progress, onChanged }: { goals: Goal[]; progress: GoalProgress[]; onChanged: () => void }) {
  const [form, setForm] = useState<{ kind: Goal['kind']; target: string; from: string; to: string }>({ kind: 'followers', target: '', from: '', to: '' });
  const progById = new Map(progress.map(p => [p.id, p]));
  const create = async () => {
    if (!form.kind || !form.target || !form.from || !form.to) return;
    await fetchJSON(`${API_BASE}/api/goals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: form.kind, target: Number(form.target), from: form.from, to: form.to }) });
    setForm({ kind: 'followers', target: '', from: '', to: '' });
    onChanged();
  };
  const remove = async (id: number) => {
    await fetchJSON(`${API_BASE}/api/goals/${id}`, { method: 'DELETE' });
    onChanged();
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <div className="text-sm text-gray-400">Type</div>
          <select value={form.kind} onChange={e=>setForm(f=>({ ...f, kind: e.target.value as any }))} className="bg-gray-950 border border-gray-800 rounded px-2 py-1">
            <option value="followers">Followers</option>
            <option value="avgViewers">Avg viewers</option>
            <option value="peakViewers">Peak viewers</option>
            <option value="duration">Durée (min)</option>
          </select>
        </div>
        <div>
          <div className="text-sm text-gray-400">Cible</div>
          <input type="number" value={form.target} onChange={e=>setForm(f=>({ ...f, target: e.target.value }))} className="bg-gray-950 border border-gray-800 rounded px-2 py-1 w-28" />
        </div>
        <div>
          <div className="text-sm text-gray-400">Du</div>
          <input type="datetime-local" value={form.from} onChange={e=>setForm(f=>({ ...f, from: e.target.value }))} className="bg-gray-950 border border-gray-800 rounded px-2 py-1" />
        </div>
        <div>
          <div className="text-sm text-gray-400">Au</div>
          <input type="datetime-local" value={form.to} onChange={e=>setForm(f=>({ ...f, to: e.target.value }))} className="bg-gray-950 border border-gray-800 rounded px-2 py-1" />
        </div>
        <button onClick={create} className="ml-2 px-3 py-1 bg-indigo-600 rounded hover:bg-indigo-500">Créer</button>
      </div>
      <div className="space-y-2">
        {goals.length === 0 ? (
          <div className="text-gray-400">Aucun objectif. Créez-en un ci-dessus.</div>
        ) : goals.map(g => {
          const p = progById.get(g.id);
          const pct = p ? p.pct : 0;
          return (
            <div key={g.id} className="bg-gray-900/50 border border-gray-800 rounded p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-300">{labelGoal(g)} — cible {g.target}</div>
                <button onClick={()=>remove(g.id)} className="text-xs text-red-400 hover:text-red-300">Supprimer</button>
              </div>
              <div className="mt-2 h-2 bg-gray-800 rounded">
                <div className="h-2 bg-emerald-500 rounded" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="text-xs text-gray-400 mt-1">{p ? `${p.current}/${p.target} (${p.pct}%)` : 'Calcul…'} • {new Date(g.from).toLocaleString()} → {new Date(g.to).toLocaleString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function labelGoal(g: Goal) {
  const map: Record<Goal['kind'], string> = { followers: 'Followers', avgViewers: 'Moyenne viewers', peakViewers: 'Pic viewers', duration: 'Durée (min)' };
  return map[g.kind] || g.kind;
}
