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

interface NotificationSettings {
  onStreamStart: boolean;
  onStreamEnd: boolean;
  onNewFollower: boolean;
  onRaidReceived: boolean;
  onViewerMilestone: boolean;
  onGoalCompleted: boolean;
  onClipSuggestion: boolean;
  onGiveawayWinner: boolean;
  viewerMilestones: number[];
  followerMilestones: number[];
}

interface Webhook {
  id: number;
  url: string;
  kind: string;
  active: boolean;
  createdAt: string;
}

const NOTIFICATION_TYPES = [
  { key: 'onStreamStart', label: 'Début de stream', icon: '🟢', description: 'Quand vous lancez un stream' },
  { key: 'onStreamEnd', label: 'Fin de stream', icon: '🔴', description: 'Quand vous terminez un stream' },
  { key: 'onNewFollower', label: 'Nouveau follower', icon: '❤️', description: 'À chaque nouveau follower' },
  { key: 'onRaidReceived', label: 'Raid reçu', icon: '⚔️', description: 'Quand quelqu\'un vous raid' },
  { key: 'onViewerMilestone', label: 'Milestone viewers', icon: '🎯', description: 'Paliers de viewers atteints' },
  { key: 'onGoalCompleted', label: 'Objectif atteint', icon: '✅', description: 'Quand vous atteignez un objectif' },
  { key: 'onClipSuggestion', label: 'Suggestion de clip', icon: '🎬', description: 'Moments à clipper détectés' },
  { key: 'onGiveawayWinner', label: 'Gagnant giveaway', icon: '🎁', description: 'Quand un gagnant est tiré' },
] as const;

export default function NotificationsPage() {
  const { data: settings, isLoading: settingsLoading } = useSWR<NotificationSettings>('/api/notifications/settings', api);
  const { data: webhooks, isLoading: webhooksLoading } = useSWR<Webhook[]>('/api/notifications/webhooks', (url: string) => api(url).catch(() => []));
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookType, setWebhookType] = useState('discord');
  const [adding, setAdding] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ url: string; success: boolean } | null>(null);

  const handleToggle = async (key: keyof NotificationSettings) => {
    if (!settings) return;
    try {
      await api('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: !settings[key] }),
      });
      mutate('/api/notifications/settings');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setAdding(true);
    try {
      await api('/api/notifications/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl.trim(), type: webhookType }),
      });
      mutate('/api/notifications/webhooks');
      setWebhookUrl('');
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveWebhook = async (id: number) => {
    if (!confirm('Supprimer ce webhook ?')) return;
    try {
      await api(`/api/notifications/webhooks/${id}`, { method: 'DELETE' });
      mutate('/api/notifications/webhooks');
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestWebhook = async (url: string) => {
    setTesting(url);
    setTestResult(null);
    try {
      const result = await api('/api/notifications/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      }) as { success: boolean };
      setTestResult({ url, success: result.success });
    } catch {
      setTestResult({ url, success: false });
    } finally {
      setTesting(null);
    }
  };

  if (settingsLoading || webhooksLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          🔔 Notifications
        </h1>
        <p className="text-sm text-gray-400 mt-1">Configurez vos webhooks et notifications Discord</p>
      </div>

      {/* Webhooks Section */}
      <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">📡 Webhooks</h2>
        
        <div className="space-y-4">
          {/* Add Webhook Form */}
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <select
              value={webhookType}
              onChange={e => setWebhookType(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              <option value="discord">Discord</option>
              <option value="generic">Générique</option>
            </select>
            <button
              onClick={handleAddWebhook}
              disabled={!webhookUrl.trim() || adding}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition whitespace-nowrap"
            >
              {adding ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>

          {/* Webhooks List */}
          {webhooks && webhooks.length > 0 ? (
            <div className="space-y-2">
              {webhooks.map(webhook => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xl">{webhook.kind === 'discord' ? '💬' : '🔗'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{webhook.url}</div>
                      <div className="text-xs text-gray-500 capitalize">{webhook.kind}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {testResult && testResult.url === webhook.url && (
                      <span className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                        {testResult.success ? '✓ OK' : '✗ Échec'}
                      </span>
                    )}
                    <button
                      onClick={() => handleTestWebhook(webhook.url)}
                      disabled={testing === webhook.url}
                      className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-gray-300 rounded-lg transition"
                    >
                      {testing === webhook.url ? '...' : 'Tester'}
                    </button>
                    <button
                      onClick={() => handleRemoveWebhook(webhook.id)}
                      className="px-3 py-1 text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">📡</div>
              <p>Aucun webhook configuré</p>
              <p className="text-sm text-gray-500 mt-1">Ajoutez un webhook Discord pour recevoir des notifications</p>
            </div>
          )}
        </div>

        {/* Help */}
        <div className="mt-6 p-4 bg-slate-800/30 rounded-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-2">💡 Comment créer un webhook Discord ?</h3>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>Ouvrez les paramètres du serveur Discord</li>
            <li>Allez dans Intégrations → Webhooks</li>
            <li>Cliquez sur &quot;Nouveau webhook&quot;</li>
            <li>Copiez l&apos;URL du webhook et collez-la ci-dessus</li>
          </ol>
        </div>
      </div>

      {/* Notification Types */}
      <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">⚙️ Types de notifications</h2>
        <p className="text-sm text-gray-400 mb-6">Choisissez les événements pour lesquels vous souhaitez recevoir des notifications</p>
        
        <div className="space-y-3">
          {NOTIFICATION_TYPES.map(({ key, label, icon, description }) => (
            <div
              key={key}
              className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{icon}</span>
                <div>
                  <div className="font-medium text-white">{label}</div>
                  <div className="text-sm text-gray-400">{description}</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings?.[key] ?? false}
                  onChange={() => handleToggle(key)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">🎯 Paliers de notification</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Paliers de viewers</label>
            <div className="flex flex-wrap gap-2">
              {(settings?.viewerMilestones ?? [50, 100, 250, 500, 1000]).map(milestone => (
                <span
                  key={milestone}
                  className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
                >
                  {milestone} viewers
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Vous serez notifié quand vous atteindrez ces paliers pendant un stream</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Paliers de followers</label>
            <div className="flex flex-wrap gap-2">
              {(settings?.followerMilestones ?? [100, 500, 1000, 5000, 10000]).map(milestone => (
                <span
                  key={milestone}
                  className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-sm"
                >
                  {milestone} followers
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Vous serez notifié quand vous atteindrez ces paliers de followers totaux</p>
          </div>
        </div>
      </div>
    </div>
  );
}
