"use client";
import useSWR from 'swr';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Skeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { Tooltip } from '../../../components/Tooltip';
import { API_BASE, fetchJSON, SessionResponse } from '../../../lib/api';

// Types
interface ClipSettings {
  id: number;
  userId: number;
  autoClipEnabled: boolean;
  autoClipThreshold: number;
  notifyOnSuggest: boolean;
  expirationDays: number;
  maxClipsPerStream: number;
}

interface ClipMoment {
  id: number;
  streamId: number;
  timestamp: string;
  score: number;
  reason: string;
  status: string;
  autoClipped: boolean;
  expiresAt: string | null;
  linkedClipId: string | null;
  stream: {
    id: number;
    title: string;
    startedAt: string;
  };
}

interface ClipStats {
  pending: number;
  clipped: number;
  rejected: number;
  expired: number;
  total: number;
  byStream: Array<{ streamId: number; title: string; count: number }>;
}

interface CreatedClip {
  id: number;
  twitchClipId: string;
  url: string;
  title: string;
  viewCount: number;
  createdAt: string;
  confirmed: boolean;
}

export default function ClipsPage() {
  const { show } = useToast();
  const [tab, setTab] = useState<'queue' | 'settings' | 'created'>('queue');
  const [selectedMoments, setSelectedMoments] = useState<Set<number>>(new Set());
  const [filterStream, setFilterStream] = useState<number | null>(null);
  const [processing, setProcessing] = useState<Set<number>>(new Set());

  // Data fetching
  const { data: session } = useSWR<SessionResponse>(`${API_BASE}/auth/session`, fetchJSON);
  const { data: settings, mutate: mutateSettings } = useSWR<ClipSettings>(
    session?.authenticated ? `${API_BASE}/api/clips/settings` : null,
    fetchJSON
  );
  const { data: queue, mutate: mutateQueue, isLoading: queueLoading } = useSWR<ClipMoment[]>(
    session?.authenticated ? `${API_BASE}/api/clips/queue${filterStream ? `?streamId=${filterStream}` : ''}` : null,
    fetchJSON,
    { refreshInterval: 30000 }
  );
  const { data: stats, mutate: mutateStats } = useSWR<ClipStats>(
    session?.authenticated ? `${API_BASE}/api/clips/stats` : null,
    fetchJSON
  );
  const { data: createdClips, mutate: mutateCreated } = useSWR<CreatedClip[]>(
    session?.authenticated && tab === 'created' ? `${API_BASE}/api/clips` : null,
    fetchJSON
  );

  // Settings handlers
  const updateSetting = useCallback(async (key: keyof ClipSettings, value: any) => {
    try {
      const res = await fetch(`${API_BASE}/api/clips/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value })
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      mutateSettings(updated, false);
      show('Paramètre mis à jour', 'success');
    } catch (error) {
      show('Erreur lors de la mise à jour', 'error');
    }
  }, [mutateSettings, show]);

  // Clip actions
  const approveClip = useCallback(async (momentId: number) => {
    setProcessing(prev => new Set(prev).add(momentId));
    try {
      const res = await fetch(`${API_BASE}/api/clips/queue/${momentId}/approve`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create clip');
      }
      show('Clip créé avec succès !', 'success');
      mutateQueue();
      mutateStats();
      mutateCreated();
      setSelectedMoments(prev => {
        const next = new Set(prev);
        next.delete(momentId);
        return next;
      });
    } catch (error: any) {
      show(error.message || 'Erreur lors de la création du clip', 'error');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(momentId);
        return next;
      });
    }
  }, [mutateQueue, mutateStats, mutateCreated, show]);

  const rejectClip = useCallback(async (momentId: number) => {
    setProcessing(prev => new Set(prev).add(momentId));
    try {
      const res = await fetch(`${API_BASE}/api/clips/queue/${momentId}/reject`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to reject');
      show('Moment rejeté', 'success');
      mutateQueue();
      mutateStats();
      setSelectedMoments(prev => {
        const next = new Set(prev);
        next.delete(momentId);
        return next;
      });
    } catch (error) {
      show('Erreur lors du rejet', 'error');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(momentId);
        return next;
      });
    }
  }, [mutateQueue, mutateStats, show]);

  const bulkApprove = useCallback(async () => {
    if (selectedMoments.size === 0) return;
    const momentIds = Array.from(selectedMoments);
    setProcessing(new Set(momentIds));
    try {
      const res = await fetch(`${API_BASE}/api/clips/queue/bulk-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ momentIds })
      });
      if (!res.ok) throw new Error('Failed to bulk approve');
      const { results } = await res.json();
      const success = results.filter((r: any) => r.success).length;
      show(`${success}/${momentIds.length} clips créés`, success > 0 ? 'success' : 'error');
      mutateQueue();
      mutateStats();
      mutateCreated();
      setSelectedMoments(new Set());
    } catch (error) {
      show('Erreur lors de la création en masse', 'error');
    } finally {
      setProcessing(new Set());
    }
  }, [selectedMoments, mutateQueue, mutateStats, mutateCreated, show]);

  const bulkReject = useCallback(async () => {
    if (selectedMoments.size === 0) return;
    const momentIds = Array.from(selectedMoments);
    setProcessing(new Set(momentIds));
    try {
      const res = await fetch(`${API_BASE}/api/clips/queue/bulk-reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ momentIds })
      });
      if (!res.ok) throw new Error('Failed to bulk reject');
      const { rejectedCount } = await res.json();
      show(`${rejectedCount} moments rejetés`, 'success');
      mutateQueue();
      mutateStats();
      setSelectedMoments(new Set());
    } catch (error) {
      show('Erreur lors du rejet en masse', 'error');
    } finally {
      setProcessing(new Set());
    }
  }, [selectedMoments, mutateQueue, mutateStats, show]);

  const toggleSelect = (id: number) => {
    setSelectedMoments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!queue) return;
    setSelectedMoments(new Set(queue.map(m => m.id)));
  };

  const selectNone = () => setSelectedMoments(new Set());

  // Format helpers
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `il y a ${days}j`;
    if (hours > 0) return `il y a ${hours}h`;
    return `il y a ${Math.floor(diff / 60000)}min`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  if (!session?.authenticated) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Connecte-toi pour gérer tes clips.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">🎬 Gestion des Clips</h1>
          <p className="text-gray-400 text-sm">
            Valide ou rejette les moments clés détectés pendant tes streams
          </p>
        </div>
        
        {/* Stats rapides */}
        {stats && (
          <div className="flex gap-4 text-sm">
            <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg">
              {stats.pending} en attente
            </div>
            <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg">
              {stats.clipped} créés
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => setTab('queue')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            tab === 'queue' 
              ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          📋 File d'attente
        </button>
        <button
          onClick={() => setTab('created')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            tab === 'created' 
              ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          ✅ Clips créés
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-2 rounded-t-lg transition-colors ${
            tab === 'settings' 
              ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-500' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          ⚙️ Paramètres
        </button>
      </div>

      {/* Queue Tab */}
      {tab === 'queue' && (
        <div className="space-y-4">
          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-3 bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-sm text-gray-400 hover:text-white"
              >
                Tout sélectionner
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={selectNone}
                className="text-sm text-gray-400 hover:text-white"
              >
                Désélectionner
              </button>
            </div>
            
            {selectedMoments.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-gray-400">
                  {selectedMoments.size} sélectionné(s)
                </span>
                <button
                  onClick={bulkApprove}
                  disabled={processing.size > 0}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-3 py-1 rounded text-sm"
                >
                  ✓ Créer les clips
                </button>
                <button
                  onClick={bulkReject}
                  disabled={processing.size > 0}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-1 rounded text-sm"
                >
                  ✕ Rejeter
                </button>
              </div>
            )}
            
            {/* Filter by stream */}
            {stats && stats.byStream.length > 1 && (
              <select
                value={filterStream ?? ''}
                onChange={(e) => setFilterStream(e.target.value ? Number(e.target.value) : null)}
                className="bg-gray-700 rounded px-2 py-1 text-sm ml-auto"
              >
                <option value="">Tous les streams</option>
                {stats.byStream.map(s => (
                  <option key={s.streamId} value={s.streamId}>
                    {s.title} ({s.count})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Queue list */}
          {queueLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : !queue || queue.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-lg">
              <p className="text-4xl mb-3">🎬</p>
              <p className="text-gray-400">Aucun moment en attente</p>
              <p className="text-gray-500 text-sm mt-1">
                Les moments clés seront détectés automatiquement pendant tes streams
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map(moment => (
                <div
                  key={moment.id}
                  className={`bg-gray-800/50 rounded-lg p-4 border transition-colors ${
                    selectedMoments.has(moment.id) 
                      ? 'border-purple-500' 
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedMoments.has(moment.id)}
                      onChange={() => toggleSelect(moment.id)}
                      className="mt-1 w-4 h-4 accent-purple-500"
                    />
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold ${getScoreColor(moment.score)}`}>
                          Score: {moment.score}
                        </span>
                        {moment.autoClipped && (
                          <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded">
                            Auto-clip
                          </span>
                        )}
                        {moment.expiresAt && (
                          <Tooltip content={`Expire le ${formatDate(moment.expiresAt)}`}>
                            <span className="text-gray-500 text-xs">
                              ⏱️ {formatTimeAgo(moment.expiresAt)}
                            </span>
                          </Tooltip>
                        )}
                      </div>
                      
                      <p className="text-gray-300 text-sm mb-2">{moment.reason}</p>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <Link 
                          href={`/history/${moment.streamId}`}
                          className="hover:text-purple-400"
                        >
                          📺 {moment.stream.title}
                        </Link>
                        <span>•</span>
                        <span>{formatDate(moment.timestamp)}</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveClip(moment.id)}
                        disabled={processing.has(moment.id)}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 p-2 rounded transition-colors"
                        title="Créer le clip"
                      >
                        {processing.has(moment.id) ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          '✓'
                        )}
                      </button>
                      <button
                        onClick={() => rejectClip(moment.id)}
                        disabled={processing.has(moment.id)}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 p-2 rounded transition-colors"
                        title="Rejeter"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Created Clips Tab */}
      {tab === 'created' && (
        <div className="space-y-4">
          {!createdClips ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : createdClips.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-lg">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-gray-400">Aucun clip créé pour le moment</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {createdClips.map(clip => (
                <div
                  key={clip.id}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
                >
                  <h3 className="font-medium mb-2 truncate">{clip.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
                    <span>👁️ {clip.viewCount} vues</span>
                    <span>•</span>
                    <span>{formatDate(clip.createdAt)}</span>
                  </div>
                  <a
                    href={clip.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm"
                  >
                    <span>🔗 Voir sur Twitch</span>
                    <span>↗</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && settings && (
        <div className="max-w-2xl space-y-6">
          {/* Auto-clip toggle */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">🤖 Auto-clip intelligent</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Crée automatiquement un clip quand un moment dépasse le seuil de score
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoClipEnabled}
                  onChange={(e) => updateSetting('autoClipEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>

          {/* Threshold slider */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium">📊 Seuil d'auto-clip</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Score minimum pour déclencher un clip automatique
                </p>
              </div>
              <span className={`font-bold text-lg ${getScoreColor(settings.autoClipThreshold)}`}>
                {settings.autoClipThreshold}
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={settings.autoClipThreshold}
              onChange={(e) => updateSetting('autoClipThreshold', Number(e.target.value))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>50 (Sensible)</span>
              <span>100 (Strict)</span>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">🔔 Notifications de suggestion</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Afficher une notification quand un moment clé est détecté
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyOnSuggest}
                  onChange={(e) => updateSetting('notifyOnSuggest', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>

          {/* Expiration days */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium">⏱️ Expiration automatique</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Supprimer les moments non validés après X jours
                </p>
              </div>
              <select
                value={settings.expirationDays}
                onChange={(e) => updateSetting('expirationDays', Number(e.target.value))}
                className="bg-gray-700 rounded px-3 py-1"
              >
                {[1, 3, 5, 7, 14, 30].map(d => (
                  <option key={d} value={d}>{d} jour{d > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Max clips per stream */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium">🎯 Limite par stream</h3>
                <p className="text-gray-400 text-sm mt-1">
                  Nombre maximum de clips suggérés par stream
                </p>
              </div>
              <select
                value={settings.maxClipsPerStream}
                onChange={(e) => updateSetting('maxClipsPerStream', Number(e.target.value))}
                className="bg-gray-700 rounded px-3 py-1"
              >
                {[5, 10, 15, 20, 30, 50].map(n => (
                  <option key={n} value={n}>{n} clips</option>
                ))}
              </select>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h4 className="text-blue-400 font-medium mb-2">💡 Comment ça marche ?</h4>
            <ul className="text-sm text-gray-300 space-y-2">
              <li>• Un <strong>score</strong> est calculé pour chaque moment basé sur l'activité chat et les pics de viewers</li>
              <li>• Les moments dépassant le seuil sont ajoutés à la file d'attente (ou auto-clippés si activé)</li>
              <li>• Tu peux valider ou rejeter chaque moment avant sa création en clip</li>
              <li>• Les moments non traités expirent automatiquement</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
