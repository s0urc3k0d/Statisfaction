"use client";
import useSWR from 'swr';
import { useState, useCallback, useEffect } from 'react';
import { Skeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { API_BASE, fetchJSON, SessionResponse } from '../../../lib/api';

// Types
interface CreatedClip {
  id: number;
  twitchClipId: string;
  url: string;
  title: string;
  viewCount: number;
  createdAt: string;
  streamId: number;
  stream?: { title: string };
}

interface CompilationJob {
  id: string;
  userId: number;
  clipIds: string[];
  format: 'landscape' | 'portrait' | 'square';
  quality: 'low' | 'medium' | 'high';
  status: 'queued' | 'downloading' | 'processing' | 'done' | 'failed';
  progress: number;
  outputPath?: string;
  error?: string;
  createdAt: string;
}

interface Compilation {
  id: number;
  jobId: string;
  clipCount: number;
  format: string;
  quality: string;
  status: string;
  title?: string;
  createdAt: string;
}

const FORMAT_OPTIONS = [
  { value: 'landscape', label: '🖥️ Paysage (16:9)', desc: 'YouTube, Twitch' },
  { value: 'portrait', label: '📱 Portrait (9:16)', desc: 'TikTok, Reels, Shorts' },
  { value: 'square', label: '⬜ Carré (1:1)', desc: 'Instagram' },
];

const QUALITY_OPTIONS = [
  { value: 'low', label: 'Rapide', desc: 'Qualité réduite, export rapide' },
  { value: 'medium', label: 'Standard', desc: 'Bon équilibre qualité/vitesse' },
  { value: 'high', label: 'Haute qualité', desc: 'Meilleure qualité, plus lent' },
];

export default function CompilationPage() {
  const { show } = useToast();
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<'landscape' | 'portrait' | 'square'>('landscape');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [title, setTitle] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Data fetching
  const { data: session } = useSWR<SessionResponse>(`${API_BASE}/auth/session`, fetchJSON);
  const { data: ffmpegStatus } = useSWR<{ ffmpegAvailable: boolean }>(
    session?.authenticated ? `${API_BASE}/api/compilation/status` : null,
    fetchJSON
  );
  const { data: clips, isLoading: clipsLoading } = useSWR<CreatedClip[]>(
    session?.authenticated ? `${API_BASE}/api/clips` : null,
    fetchJSON
  );
  const { data: activeJobs, mutate: mutateJobs } = useSWR<CompilationJob[]>(
    session?.authenticated ? `${API_BASE}/api/compilation/jobs` : null,
    fetchJSON,
    { refreshInterval: activeJobId ? 3000 : 0 }
  );
  const { data: history, mutate: mutateHistory } = useSWR<Compilation[]>(
    session?.authenticated ? `${API_BASE}/api/compilation/history` : null,
    fetchJSON
  );

  // Poll active job status
  const { data: activeJob } = useSWR<CompilationJob>(
    activeJobId ? `${API_BASE}/api/compilation/job/${activeJobId}` : null,
    fetchJSON,
    { refreshInterval: 2000 }
  );

  // Track job completion
  useEffect(() => {
    if (activeJob?.status === 'done') {
      show('🎬 Compilation terminée !', 'success');
      setActiveJobId(null);
      mutateHistory();
      mutateJobs();
    } else if (activeJob?.status === 'failed') {
      show(`❌ Échec: ${activeJob.error || 'Erreur inconnue'}`, 'error');
      setActiveJobId(null);
    }
  }, [activeJob?.status, activeJob?.error, show, mutateHistory, mutateJobs]);

  // Toggle clip selection
  const toggleClip = useCallback((clipId: string) => {
    setSelectedClips(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else if (next.size < 20) {
        next.add(clipId);
      } else {
        show('Maximum 20 clips par compilation', 'error');
      }
      return next;
    });
  }, [show]);

  // Start compilation
  const startCompilation = useCallback(async () => {
    if (selectedClips.size === 0) {
      show('Sélectionne au moins un clip', 'error');
      return;
    }

    setIsStarting(true);
    try {
      const res = await fetch(`${API_BASE}/api/compilation/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clipIds: Array.from(selectedClips),
          format,
          quality,
          title: title || undefined,
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start compilation');
      }

      const { jobId } = await res.json();
      setActiveJobId(jobId);
      setSelectedClips(new Set());
      setTitle('');
      show('🚀 Compilation démarrée !', 'success');
      mutateJobs();
    } catch (error: any) {
      show(error.message || 'Erreur lors du démarrage', 'error');
    } finally {
      setIsStarting(false);
    }
  }, [selectedClips, format, quality, title, show, mutateJobs]);

  // Delete compilation
  const deleteComp = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/compilation/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete');
      show('Compilation supprimée', 'success');
      mutateHistory();
    } catch {
      show('Erreur lors de la suppression', 'error');
    }
  }, [show, mutateHistory]);

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      queued: 'bg-yellow-500/20 text-yellow-400',
      downloading: 'bg-blue-500/20 text-blue-400',
      processing: 'bg-purple-500/20 text-purple-400',
      done: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
    };
    const labels: Record<string, string> = {
      queued: 'En attente',
      downloading: 'Téléchargement',
      processing: 'Traitement',
      done: 'Terminé',
      failed: 'Échec',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${styles[status] || ''}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (!session?.authenticated) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Connecte-toi pour créer des compilations.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">🎞️ Compilations</h1>
        <p className="text-gray-400 text-sm mt-1">
          Crée des montages vidéo à partir de tes clips pour YouTube, TikTok, etc.
        </p>
      </div>

      {/* FFmpeg status warning */}
      {ffmpegStatus && !ffmpegStatus.ffmpegAvailable && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-400 font-medium">⚠️ FFmpeg non disponible</p>
          <p className="text-gray-400 text-sm mt-1">
            La fonctionnalité de compilation nécessite FFmpeg. Contacte l'administrateur pour l'activer.
          </p>
        </div>
      )}

      {/* Active job progress */}
      {activeJob && (activeJob.status === 'queued' || activeJob.status === 'downloading' || activeJob.status === 'processing') && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-400 font-medium">
              🎬 Compilation en cours...
            </span>
            {getStatusBadge(activeJob.status)}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-purple-500 h-3 transition-all duration-500 ease-out"
              style={{ width: `${activeJob.progress}%` }}
            />
          </div>
          <p className="text-gray-400 text-sm mt-2">
            {activeJob.progress}% - {activeJob.clipIds.length} clips
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Clip Selection */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">📎 Sélection des clips</h2>
          
          {clipsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : !clips || clips.length === 0 ? (
            <div className="bg-gray-800/30 rounded-lg p-8 text-center">
              <p className="text-4xl mb-3">🎬</p>
              <p className="text-gray-400">Aucun clip disponible</p>
              <p className="text-gray-500 text-sm mt-1">
                Crée des clips depuis la page Clips pour les utiliser ici
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {clips.map(clip => (
                <div
                  key={clip.twitchClipId}
                  onClick={() => toggleClip(clip.twitchClipId)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedClips.has(clip.twitchClipId)
                      ? 'bg-purple-500/20 border-purple-500'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedClips.has(clip.twitchClipId)}
                      onChange={() => {}}
                      className="w-4 h-4 accent-purple-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{clip.title}</p>
                      <p className="text-gray-400 text-xs">
                        👁️ {clip.viewCount} vues • {formatDate(clip.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {selectedClips.size > 0 && (
            <p className="text-sm text-gray-400">
              {selectedClips.size} clip(s) sélectionné(s) sur 20 max
            </p>
          )}
        </div>

        {/* Configuration */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">⚙️ Configuration</h2>
          
          {/* Format */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="font-medium mb-3">Format de sortie</h3>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    format === opt.value
                      ? 'bg-purple-500/20 border-purple-500'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={opt.value}
                    checked={format === opt.value}
                    onChange={(e) => setFormat(e.target.value as any)}
                    className="accent-purple-500"
                  />
                  <div>
                    <span className="font-medium">{opt.label}</span>
                    <p className="text-gray-400 text-xs">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="font-medium mb-3">Qualité</h3>
            <div className="flex gap-2">
              {QUALITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setQuality(opt.value as any)}
                  className={`flex-1 p-2 rounded-lg border text-sm transition-colors ${
                    quality === opt.value
                      ? 'bg-purple-500/20 border-purple-500'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="font-medium mb-3">Titre (optionnel)</h3>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ma super compilation..."
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500"
            />
          </div>

          {/* Start button */}
          <button
            onClick={startCompilation}
            disabled={selectedClips.size === 0 || isStarting || !ffmpegStatus?.ffmpegAvailable || !!activeJobId}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-medium transition-colors"
          >
            {isStarting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span> Démarrage...
              </span>
            ) : (
              `🎬 Créer la compilation (${selectedClips.size} clips)`
            )}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">📚 Historique</h2>
        
        {!history || history.length === 0 ? (
          <div className="bg-gray-800/30 rounded-lg p-8 text-center">
            <p className="text-gray-400">Aucune compilation créée</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {history.map(comp => (
              <div
                key={comp.id}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium truncate">
                    {comp.title || `Compilation #${comp.id}`}
                  </h3>
                  {getStatusBadge(comp.status)}
                </div>
                
                <div className="text-sm text-gray-400 space-y-1 mb-3">
                  <p>🎬 {comp.clipCount} clips</p>
                  <p>📐 {FORMAT_OPTIONS.find(f => f.value === comp.format)?.label || comp.format}</p>
                  <p>📅 {formatDate(comp.createdAt)}</p>
                </div>
                
                <div className="flex gap-2">
                  {comp.status === 'done' && (
                    <a
                      href={`${API_BASE}/api/compilation/${comp.id}/download`}
                      className="flex-1 bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-sm text-center transition-colors"
                    >
                      ⬇️ Télécharger
                    </a>
                  )}
                  <button
                    onClick={() => deleteComp(comp.id)}
                    className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
