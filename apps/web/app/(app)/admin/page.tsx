"use client";
import useSWR from 'swr';
import { API_BASE, fetchJSON, NotificationWebhook } from '../../../lib/api';
import { Skeleton } from '../../../components/Skeleton';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../components/Toast';
import { SessionResponse } from '../../../lib/api';

type Subs = { total?: number; data: any[] };

export default function AdminPage() {
  const { show } = useToast();
  const router = useRouter();
  const { data: session } = useSWR<SessionResponse>(`${API_BASE}/auth/session`, fetchJSON);
  useEffect(() => {
    if (session && (!session.user || !session.user.isAdmin)) {
      router.replace('/dashboard');
    }
  }, [session, router]);
  const { data, error, isLoading, mutate } = useSWR<Subs>(`${API_BASE}/api/admin/eventsub/subscriptions`, fetchJSON);
  const { data: hooks, mutate: mutateHooks, isLoading: hooksLoading, error: hooksError } = useSWR<NotificationWebhook[]>(`${API_BASE}/api/admin/webhooks`, fetchJSON);

  // Form state pour ajout webhook
  const [kind, setKind] = useState<'discord'|'slack'|'custom'>('discord');
  const [url, setUrl] = useState('');
  const [active, setActive] = useState(true);

  const remove = async (id: string) => {
    try {
  const r = await fetch(`${API_BASE}/api/admin/eventsub/subscriptions/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error('DELETE failed');
      show('Subscription supprimée', 'success');
      mutate();
    } catch (e) {
      show("Échec suppression subscription", 'error');
    }
  };
  const resync = async () => {
    try {
  const r = await fetch(`${API_BASE}/api/admin/eventsub/resync`, { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('RESYNC failed');
      show('Resync lancé', 'success');
      mutate();
    } catch (e) {
      show('Échec resync', 'error');
    }
  };
  const prune = async () => {
    try {
  const r = await fetch(`${API_BASE}/api/admin/eventsub/prune`, { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('PRUNE failed');
      const j = await r.json();
      show(`Prune effectué: ${j.pruned ?? 0} supprimés`, 'success');
      mutate();
    } catch (e) {
      show('Échec prune', 'error');
    }
  };

  const healthCheck = async () => {
    try {
  const r = await fetch(`${API_BASE}/api/admin/eventsub/health-check`, { method: 'POST', credentials: 'include' });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error('HEALTH failed');
      show(`Health check ok: ${j.repaired ?? 0} réparés`, 'success');
      mutate();
    } catch (e) {
      show('Échec health check', 'error');
    }
  };

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [max, setMax] = useState<number>(1000);
  const [importing, setImporting] = useState(false);
  const [lastImported, setLastImported] = useState<number | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<Array<{ id: number; twitchId: string; login?: string|null; displayName?: string|null }>>([]);
  const [targetUser, setTargetUser] = useState<{ id: number; twitchId: string; label: string } | null>(null);

  const searchUsers = async () => {
    try {
  const r = await fetch(`${API_BASE}/api/admin/users?q=${encodeURIComponent(userQuery)}`, { credentials: 'include' });
      if (!r.ok) throw new Error('search failed');
      const j = await r.json();
      setUsers(j);
    } catch { setUsers([]); }
  };

  const importVods = async () => {
    try {
      setImporting(true);
      setLastImported(null);
      const body: any = { max, from: from || undefined, to: to || undefined };
      if (targetUser?.id) body.userId = targetUser.id;
  const r = await fetch(`${API_BASE}/api/admin/import/vods`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error('IMPORT failed');
      setLastImported(j.imported ?? 0);
      show(`Import VODs: ${j.imported ?? 0} ajoutées`, 'success');
    } catch (e) {
      show('Échec import VODs', 'error');
    } finally {
      setImporting(false);
    }
  };

  const addWebhook = async (e: FormEvent) => {
    e.preventDefault();
    try {
  const r = await fetch(`${API_BASE}/api/admin/webhooks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, url, active }),
      });
      if (!r.ok) throw new Error('CREATE failed');
      setUrl('');
      setKind('discord');
      setActive(true);
      show('Webhook créé', 'success');
      mutateHooks();
    } catch (e) {
      show('Échec création webhook', 'error');
    }
  };

  const deleteWebhook = async (id: number) => {
    try {
  const r = await fetch(`${API_BASE}/api/admin/webhooks/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error('DELETE failed');
      show('Webhook supprimé', 'success');
      mutateHooks();
    } catch (e) {
      show('Échec suppression webhook', 'error');
    }
  };

  const testWebhook = async (id: number) => {
    try {
  const r = await fetch(`${API_BASE}/api/admin/webhooks/${id}/test`, { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('TEST failed');
      show('Webhook testé (ping envoyé)', 'success');
    } catch (e) {
      show('Échec test webhook', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin EventSub</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const redirect = `${window.location.origin}/admin`;
              window.location.href = `${API_BASE}/auth/twitch/rescope?redirect=${encodeURIComponent(redirect)}`;
            }}
            className="px-3 py-2 bg-sky-700 rounded hover:bg-sky-600"
            title="Ajoute les autorisations Twitch (moderator:read:followers)"
          >
            Autoriser followers (rescope)
          </button>
          <button onClick={prune} className="px-3 py-2 bg-amber-600 rounded hover:bg-amber-500">Prune maintenant</button>
          <button onClick={resync} className="px-3 py-2 bg-indigo-600 rounded hover:bg-indigo-500">Resync</button>
          <button onClick={healthCheck} className="px-3 py-2 bg-emerald-600 rounded hover:bg-emerald-500">Health check</button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <input value={userQuery} onChange={e=>setUserQuery(e.target.value)} placeholder="Rechercher un utilisateur…" className="input text-xs w-56" />
              <button onClick={searchUsers} className="btn btn-muted text-xs">Rechercher</button>
              {users.length > 0 && (
                <select className="input text-xs" onChange={e=>{
                  const id = Number(e.target.value);
                  const u = users.find(x => x.id === id);
                  if (u) setTargetUser({ id: u.id, twitchId: u.twitchId, label: u.displayName || u.login || u.twitchId });
                }} value={targetUser?.id || ''}>
                  <option value="">— Sélectionner —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.displayName || u.login || u.twitchId}</option>
                  ))}
                </select>
              )}
              {targetUser && (
                <span className="text-xs text-muted">Cible: {targetUser.label}</span>
              )}
            </div>
            <input type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)} className="input text-xs" title="Du" />
            <input type="datetime-local" value={to} onChange={e=>setTo(e.target.value)} className="input text-xs" title="Au" />
            <input type="number" min={1} max={5000} value={max} onChange={e=>setMax(Math.max(1, Math.min(5000, Number(e.target.value)||1000)))} className="input w-24 text-xs" title="Max" />
            <button disabled={importing} onClick={importVods} className="px-3 py-2 bg-fuchsia-600 rounded hover:bg-fuchsia-500 disabled:opacity-60">{importing?'Import…':'Importer VODs'}</button>
          </div>
        </div>
        {lastImported!=null && <div className="text-xs text-muted">Dernier import: {lastImported} VOD(s) ajoutée(s).</div>}
      </div>
      {isLoading && (
        <div className="space-y-2">
          <Skeleton variant="card" className="h-16" />
          <Skeleton variant="card" className="h-16" />
        </div>
      )}
      {error && <div className="text-red-400">Erreur de chargement.</div>}
      {data && (
        <div className="space-y-2">
          <div className="text-sm text-gray-400">Total: {data.total ?? data.data.length}</div>
          {data.data.map((s: any) => (
            <div key={s.id} className="bg-gray-900/60 border border-gray-800 rounded p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.type}</div>
                  <div className="text-xs text-gray-400">status: {s.status} • version: {s.version} • cost: {s.cost}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span>ID: {s.id}</span>
                    {s.created_at ? <span> • créé: {new Date(s.created_at).toLocaleString()}</span> : null}
                    {s.expires_at ? <span> • expire: {new Date(s.expires_at).toLocaleString()}</span> : null}
                  </div>
                  {s.condition ? (
                    <div className="text-xs text-gray-500 mt-1">condition: {Object.entries(s.condition).map(([k,v])=>`${k}:${v}`).join(', ')}</div>
                  ) : null}
                </div>
                <button onClick={() => remove(s.id)} className="px-3 py-2 bg-rose-600 rounded hover:bg-rose-500">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section Webhooks */}
      <div className="pt-6 border-t border-gray-800">
        <h2 className="text-xl font-semibold mb-3">Notifications Webhooks</h2>
        <form onSubmit={addWebhook} className="bg-gray-900/60 border border-gray-800 rounded p-4 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-gray-300">Type</span>
            <select value={kind} onChange={e=>setKind(e.target.value as any)} className="bg-gray-800 border border-gray-700 rounded px-2 py-2">
              <option value="discord">Discord</option>
              <option value="slack">Slack</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="flex-1 min-w-[240px] flex flex-col text-sm">
            <span className="mb-1 text-gray-300">URL</span>
            <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." className="bg-gray-800 border border-gray-700 rounded px-3 py-2" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-brand" checked={active} onChange={e=>setActive(e.target.checked)} />
            <span>Actif</span>
          </label>
          <button type="submit" className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-500">Ajouter</button>
        </form>

        {hooksLoading && (
          <div className="space-y-2 mt-3">
            <Skeleton variant="card" className="h-16" />
            <Skeleton variant="card" className="h-16" />
          </div>
        )}
        {hooksError && <div className="text-red-400 mt-2">Erreur de chargement des webhooks.</div>}
        {hooks && hooks.length > 0 && (
          <div className="mt-3 space-y-2">
            {hooks.map(h => (
              <div key={h.id} className="bg-gray-900/60 border border-gray-800 rounded p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{h.kind} {h.active ? <span className="text-emerald-400 text-xs align-middle">(actif)</span> : <span className="text-gray-400 text-xs align-middle">(inactif)</span>}</div>
                  <div className="text-xs text-gray-400 break-all">{h.url}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>testWebhook(h.id)} className="px-3 py-2 bg-teal-600 rounded hover:bg-teal-500">Tester</button>
                  <button onClick={()=>deleteWebhook(h.id)} className="px-3 py-2 bg-rose-600 rounded hover:bg-rose-500">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {hooks && hooks.length === 0 && (
          <div className="text-sm text-gray-400 mt-3">Aucun webhook configuré.</div>
        )}
      </div>
    </div>
  );
}
