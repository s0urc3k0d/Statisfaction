'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { API_BASE, fetchJSON } from '../../../lib/api';
import { Spinner } from '../../../components/Spinner';

const api = async (url: string, options?: RequestInit) => {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: 'include',
  });
  if (!res.ok) throw new Error('API error');
  return res.json();
};

type GiveawayStatus = 'draft' | 'active' | 'ended' | 'cancelled';
type EntryMethod = 'chat' | 'followers' | 'manual';

interface Giveaway {
  id: number;
  title: string;
  description: string | null;
  prize: string;
  status: GiveawayStatus;
  entryMethod: EntryMethod;
  keyword: string | null;
  subscriberOnly: boolean;
  winnersCount: number;
  startedAt: string | null;
  endedAt: string | null;
  entriesCount: number;
  uniqueParticipants: number;
  winners: Array<{ username: string; displayName: string | null; position: number; claimed: boolean }>;
}

interface CreateGiveawayForm {
  title: string;
  description: string;
  prize: string;
  entryMethod: EntryMethod;
  keyword: string;
  subscriberOnly: boolean;
  winnersCount: number;
}

const STATUS_COLORS: Record<GiveawayStatus, string> = {
  draft: 'bg-gray-500',
  active: 'bg-green-500',
  ended: 'bg-blue-500',
  cancelled: 'bg-red-500',
};

const STATUS_LABELS: Record<GiveawayStatus, string> = {
  draft: 'Brouillon',
  active: 'En cours',
  ended: 'Terminé',
  cancelled: 'Annulé',
};

export default function GiveawayPage() {
  const { data: giveaways, isLoading, error } = useSWR<Giveaway[]>('/api/giveaways', api);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGiveaway, setSelectedGiveaway] = useState<Giveaway | null>(null);
  const [form, setForm] = useState<CreateGiveawayForm>({
    title: '',
    description: '',
    prize: '',
    entryMethod: 'chat',
    keyword: '',
    subscriberOnly: false,
    winnersCount: 1,
  });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.title || !form.prize) return;
    setSaving(true);
    try {
      await api('/api/giveaways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      mutate('/api/giveaways');
      setShowCreate(false);
      setForm({ title: '', description: '', prize: '', entryMethod: 'chat', keyword: '', subscriberOnly: false, winnersCount: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (giveaway: Giveaway, action: 'start' | 'end' | 'cancel' | 'draw') => {
    const endpoint = action === 'draw' ? `/api/giveaways/${giveaway.id}/draw` : `/api/giveaways/${giveaway.id}/${action}`;
    try {
      await api(endpoint, { method: 'POST' });
      mutate('/api/giveaways');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce giveaway ?')) return;
    try {
      await api(`/api/giveaways/${id}`, { method: 'DELETE' });
      mutate('/api/giveaways');
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <div className="text-red-400 p-4">Erreur de chargement</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            🎁 Giveaway Manager
          </h1>
          <p className="text-sm text-gray-400 mt-1">Organisez des tirages au sort pour votre communauté</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
        >
          + Nouveau Giveaway
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total" value={giveaways?.length ?? 0} icon="🎁" />
        <StatCard label="En cours" value={giveaways?.filter(g => g.status === 'active').length ?? 0} icon="🔥" color="text-green-400" />
        <StatCard label="Terminés" value={giveaways?.filter(g => g.status === 'ended').length ?? 0} icon="✅" color="text-blue-400" />
        <StatCard label="Participants" value={giveaways?.reduce((sum, g) => sum + g.uniqueParticipants, 0) ?? 0} icon="👥" color="text-purple-400" />
      </div>

      {/* Giveaways List */}
      <div className="space-y-4">
        {giveaways?.length === 0 ? (
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-8 text-center">
            <div className="text-4xl mb-3">🎁</div>
            <h3 className="text-lg font-medium text-white mb-2">Aucun giveaway</h3>
            <p className="text-gray-400 text-sm mb-4">Créez votre premier giveaway pour engager votre communauté</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
            >
              Créer un giveaway
            </button>
          </div>
        ) : (
          giveaways?.map(giveaway => (
            <div
              key={giveaway.id}
              className="bg-[#0f172a] rounded-xl border border-slate-800 p-5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{giveaway.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${STATUS_COLORS[giveaway.status]}`}>
                      {STATUS_LABELS[giveaway.status]}
                    </span>
                    {giveaway.subscriberOnly && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">
                        Sub only
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <span>🎁 {giveaway.prize}</span>
                    {giveaway.keyword && <span>🔤 Mot-clé: <code className="bg-slate-800 px-1 rounded">{giveaway.keyword}</code></span>}
                    <span>🏆 {giveaway.winnersCount} gagnant{giveaway.winnersCount > 1 ? 's' : ''}</span>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-gray-300">
                      <span className="text-gray-500">Participations:</span> {giveaway.entriesCount}
                    </span>
                    <span className="text-gray-300">
                      <span className="text-gray-500">Participants:</span> {giveaway.uniqueParticipants}
                    </span>
                  </div>

                  {/* Winners */}
                  {giveaway.winners.length > 0 && (
                    <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-sm font-medium text-gray-300 mb-2">🏆 Gagnants</div>
                      <div className="flex flex-wrap gap-2">
                        {giveaway.winners.map(w => (
                          <span
                            key={w.position}
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              w.claimed ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                            }`}
                          >
                            #{w.position} {w.displayName || w.username}
                            {w.claimed && ' ✓'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {giveaway.status === 'draft' && (
                    <>
                      <button
                        onClick={() => handleAction(giveaway, 'start')}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition"
                      >
                        Démarrer
                      </button>
                      <button
                        onClick={() => handleDelete(giveaway.id)}
                        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition"
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                  {giveaway.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleAction(giveaway, 'draw')}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition"
                      >
                        🎲 Tirer au sort
                      </button>
                      <button
                        onClick={() => handleAction(giveaway, 'end')}
                        className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-sm font-medium transition"
                      >
                        Terminer
                      </button>
                      <button
                        onClick={() => handleAction(giveaway, 'cancel')}
                        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition"
                      >
                        Annuler
                      </button>
                    </>
                  )}
                  {giveaway.status === 'ended' && giveaway.winners.length > 0 && (
                    <button
                      onClick={() => setSelectedGiveaway(giveaway)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition"
                    >
                      Détails
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-white mb-6">🎁 Nouveau Giveaway</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Titre</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Giveaway 1000 followers"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Prix / Récompense</label>
                <input
                  type="text"
                  value={form.prize}
                  onChange={e => setForm(f => ({ ...f, prize: e.target.value }))}
                  placeholder="Ex: 1 mois d'abonnement"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description (optionnel)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Règles du giveaway..."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Méthode d&apos;inscription</label>
                <select
                  value={form.entryMethod}
                  onChange={e => setForm(f => ({ ...f, entryMethod: e.target.value as EntryMethod }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="chat">Mot-clé dans le chat</option>
                  <option value="followers">Followers automatiques</option>
                  <option value="manual">Ajout manuel</option>
                </select>
              </div>

              {form.entryMethod === 'chat' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Mot-clé</label>
                  <input
                    type="text"
                    value={form.keyword}
                    onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
                    placeholder="Ex: !giveaway"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Nombre de gagnants</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.winnersCount}
                    onChange={e => setForm(f => ({ ...f, winnersCount: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                
                <label className="flex items-center gap-2 cursor-pointer pt-6">
                  <input
                    type="checkbox"
                    checked={form.subscriberOnly}
                    onChange={e => setForm(f => ({ ...f, subscriberOnly: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">Sub only</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg font-medium transition"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.title || !form.prize || saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                {saving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedGiveaway && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedGiveaway(null)}>
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2">{selectedGiveaway.title}</h2>
            <p className="text-gray-400 mb-6">🎁 {selectedGiveaway.prize}</p>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Participations totales</span>
                <span className="text-white font-medium">{selectedGiveaway.entriesCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Participants uniques</span>
                <span className="text-white font-medium">{selectedGiveaway.uniqueParticipants}</span>
              </div>
            </div>

            {selectedGiveaway.winners.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3">🏆 Gagnants</h3>
                <div className="space-y-2">
                  {selectedGiveaway.winners.map(w => (
                    <div
                      key={w.position}
                      className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{w.position === 1 ? '🥇' : w.position === 2 ? '🥈' : '🥉'}</span>
                        <span className="text-white font-medium">{w.displayName || w.username}</span>
                      </div>
                      <span className={`text-sm ${w.claimed ? 'text-green-400' : 'text-yellow-400'}`}>
                        {w.claimed ? '✓ Réclamé' : '⏳ En attente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedGiveaway(null)}
              className="w-full mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg font-medium transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color = 'text-white' }: { label: string; value: number; icon: string; color?: string }) {
  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}
