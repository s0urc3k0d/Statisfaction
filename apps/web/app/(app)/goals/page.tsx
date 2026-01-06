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

type GoalKind = 'followers' | 'avgViewers' | 'peakViewers' | 'streamHours' | 'streamCount' | 'newFollowers' | 'chatMessages';

interface Goal {
  id: number;
  kind: GoalKind;
  target: number;
  from: string;
  to: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  current: number;
  progress: number;
  completed: boolean;
  daysRemaining: number;
  dailyRequired: number | null;
}

interface Achievement {
  id: number;
  kind: string;
  title: string;
  description: string | null;
  icon: string;
  unlockedAt: string;
}

interface CreateGoalForm {
  kind: GoalKind;
  target: number;
  from: string;
  to: string;
  title: string;
  description: string;
}

const GOAL_KINDS: { value: GoalKind; label: string; icon: string; unit: string }[] = [
  { value: 'followers', label: 'Followers totaux', icon: '❤️', unit: 'followers' },
  { value: 'newFollowers', label: 'Nouveaux followers', icon: '💜', unit: 'followers' },
  { value: 'avgViewers', label: 'Moyenne viewers', icon: '👥', unit: 'viewers' },
  { value: 'peakViewers', label: 'Pic viewers', icon: '🔥', unit: 'viewers' },
  { value: 'streamHours', label: 'Heures de stream', icon: '⏰', unit: 'heures' },
  { value: 'streamCount', label: 'Nombre de streams', icon: '📺', unit: 'streams' },
  { value: 'chatMessages', label: 'Messages de chat', icon: '💬', unit: 'messages' },
];

export default function GoalsPage() {
  const { data: goals, isLoading: goalsLoading } = useSWR<Goal[]>('/api/goals', api);
  const { data: achievements, isLoading: achievementsLoading } = useSWR<Achievement[]>('/api/achievements', api);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'achievements'>('active');
  
  const today = new Date().toISOString().split('T')[0];
  const inOneMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [form, setForm] = useState<CreateGoalForm>({
    kind: 'followers',
    target: 100,
    from: today,
    to: inOneMonth,
    title: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const activeGoals = goals?.filter(g => !g.completed && g.daysRemaining > 0) ?? [];
  const completedGoals = goals?.filter(g => g.completed) ?? [];

  const handleCreate = async () => {
    if (!form.target || form.target <= 0) return;
    setSaving(true);
    try {
      await api('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      mutate('/api/goals');
      setShowCreate(false);
      setForm({ kind: 'followers', target: 100, from: today, to: inOneMonth, title: '', description: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cet objectif ?')) return;
    try {
      await api(`/api/goals/${id}`, { method: 'DELETE' });
      mutate('/api/goals');
    } catch (err) {
      console.error(err);
    }
  };

  const getKindInfo = (kind: string) => GOAL_KINDS.find(k => k.value === kind) ?? { label: kind, icon: '🎯', unit: '' };

  if (goalsLoading || achievementsLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            🎯 Objectifs & Succès
          </h1>
          <p className="text-sm text-gray-400 mt-1">Définissez vos objectifs et suivez votre progression</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
        >
          + Nouvel objectif
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === 'active' 
              ? 'text-purple-400 border-purple-400' 
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          🎯 En cours ({activeGoals.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === 'completed' 
              ? 'text-purple-400 border-purple-400' 
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          ✅ Complétés ({completedGoals.length})
        </button>
        <button
          onClick={() => setActiveTab('achievements')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === 'achievements' 
              ? 'text-purple-400 border-purple-400' 
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          🏆 Succès ({achievements?.length ?? 0})
        </button>
      </div>

      {/* Active Goals */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeGoals.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="Aucun objectif en cours"
              description="Définissez un objectif pour rester motivé"
              action={<button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition">Créer un objectif</button>}
            />
          ) : (
            activeGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} kindInfo={getKindInfo(goal.kind)} onDelete={() => handleDelete(goal.id)} />
            ))
          )}
        </div>
      )}

      {/* Completed Goals */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          {completedGoals.length === 0 ? (
            <EmptyState
              icon="✅"
              title="Aucun objectif complété"
              description="Vos objectifs atteints apparaîtront ici"
            />
          ) : (
            completedGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} kindInfo={getKindInfo(goal.kind)} onDelete={() => handleDelete(goal.id)} completed />
            ))
          )}
        </div>
      )}

      {/* Achievements */}
      {activeTab === 'achievements' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {achievements?.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon="🏆"
                title="Aucun succès débloqué"
                description="Atteignez vos objectifs pour débloquer des succès"
              />
            </div>
          ) : (
            achievements?.map(achievement => (
              <div
                key={achievement.id}
                className="bg-[#0f172a] rounded-xl border border-slate-800 p-4 text-center hover:border-purple-500/50 transition"
              >
                <div className="text-4xl mb-2">{achievement.icon}</div>
                <h3 className="font-semibold text-white text-sm mb-1">{achievement.title}</h3>
                {achievement.description && (
                  <p className="text-xs text-gray-400 mb-2">{achievement.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  {new Date(achievement.unlockedAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f172a] rounded-2xl border border-slate-800 w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-white mb-6">🎯 Nouvel Objectif</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Type d&apos;objectif</label>
                <div className="grid grid-cols-2 gap-2">
                  {GOAL_KINDS.map(kind => (
                    <button
                      key={kind.value}
                      onClick={() => setForm(f => ({ ...f, kind: kind.value }))}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition ${
                        form.kind === kind.value
                          ? 'border-purple-500 bg-purple-500/10 text-white'
                          : 'border-slate-700 bg-slate-800/50 text-gray-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xl">{kind.icon}</span>
                      <span className="text-sm">{kind.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Objectif ({getKindInfo(form.kind).unit})
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={form.from}
                    onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={form.to}
                    onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Titre personnalisé (optionnel)</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={`Atteindre ${form.target} ${getKindInfo(form.kind).unit}`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
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
                disabled={!form.target || form.target <= 0 || saving}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
              >
                {saving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ 
  goal, 
  kindInfo, 
  onDelete,
  completed = false 
}: { 
  goal: Goal; 
  kindInfo: { label: string; icon: string; unit: string }; 
  onDelete: () => void;
  completed?: boolean;
}) {
  const progressColor = goal.progress >= 100 ? 'bg-green-500' : goal.progress >= 50 ? 'bg-yellow-500' : 'bg-purple-500';
  
  return (
    <div className={`bg-[#0f172a] rounded-xl border ${completed ? 'border-green-500/30' : 'border-slate-800'} p-5`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{kindInfo.icon}</span>
          <div>
            <h3 className="font-semibold text-white">
              {goal.title || `${kindInfo.label}`}
            </h3>
            <p className="text-sm text-gray-400">
              Objectif: {goal.target.toLocaleString()} {kindInfo.unit}
            </p>
          </div>
        </div>
        {!completed && (
          <button
            onClick={onDelete}
            className="text-gray-500 hover:text-red-400 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Progression</span>
          <span className={completed ? 'text-green-400' : 'text-white'}>
            {goal.current.toLocaleString()} / {goal.target.toLocaleString()} ({goal.progress}%)
          </span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-500`}
            style={{ width: `${Math.min(100, goal.progress)}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          {completed ? (
            <span className="text-green-400">✓ Objectif atteint !</span>
          ) : (
            `${goal.daysRemaining} jour${goal.daysRemaining > 1 ? 's' : ''} restant${goal.daysRemaining > 1 ? 's' : ''}`
          )}
        </span>
        {!completed && goal.dailyRequired && goal.dailyRequired > 0 && (
          <span className="text-gray-500">
            ~{goal.dailyRequired.toLocaleString()} {kindInfo.unit}/jour requis
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ 
  icon, 
  title, 
  description, 
  action 
}: { 
  icon: string; 
  title: string; 
  description: string; 
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-8 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm mb-4">{description}</p>
      {action}
    </div>
  );
}
