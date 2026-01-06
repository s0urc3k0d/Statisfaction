"use client";
import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE, fetchJSON, ScheduleEntry, TitleSuggestionsResp } from '../../../lib/api';
import { Skeleton } from '../../../components/Skeleton';
import { useToast } from '../../../components/Toast';
import { MeResponse } from '../../../lib/api';
import { Adsense } from '../../../components/Adsense';

export default function ToolsPage() {
  const { show } = useToast();
  const { data: me, mutate: mutateMe } = useSWR<MeResponse>(`${API_BASE}/api/me`, fetchJSON);
  // Sous-onglets
  const [tab, setTab] = useState<'utilitaires' | 'configuration'>(() => 'utilitaires');
  useEffect(() => {
    const applyFromHash = () => {
      const h = (typeof window !== 'undefined' ? window.location.hash.replace('#','') : '').toLowerCase();
      if (h === 'configuration' || h === 'config') setTab('configuration');
      else if (h === 'utilitaires' || h === 'utils') setTab('utilitaires');
    };
    applyFromHash();
    const onHash = () => applyFromHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const switchTab = (t: 'utilitaires' | 'configuration') => {
    setTab(t);
    if (typeof window !== 'undefined') {
      const hash = t === 'configuration' ? '#configuration' : '#utilitaires';
      if (window.location.hash !== hash) window.location.hash = hash;
    }
  };
  // Générateur de titres
  const [keywords, setKeywords] = useState('');
  const [titles, setTitles] = useState<string[]>([]);
  const { data: serverSuggestions, isLoading: suggLoading, mutate: mutateSugg } = useSWR<TitleSuggestionsResp>(`${API_BASE}/api/tools/title-suggestions`, fetchJSON);
  useEffect(() => {
    if (serverSuggestions?.suggestions) setTitles(serverSuggestions.suggestions);
  }, [serverSuggestions]);
  const generateLocal = () => {
    const parts = keywords.split(/[\,\s]+/).filter(Boolean);
    const samples = [
      `Live ${parts[0] || 'Découverte'} | ${parts[1] || 'Gameplay'} | ${parts[2] || 'FR'}`,
      `${parts[0] || 'Rage'} & ${parts[1] || 'Clutch'} | Road to ${Math.floor(Math.random()*1000)}!`,
      `Soirée ${parts[0] || 'Tryhard'} • ${parts[1] || 'Fun'} • Rejoins le chat!`,
    ];
    setTitles(samples);
  };

  // Planificateur
  const { data: schedule, isLoading: schedLoading, mutate: mutateSched } = useSWR<ScheduleEntry[]>(`${API_BASE}/api/schedule`, fetchJSON);
  const [form, setForm] = useState<{ title: string; category: string; from: string; to: string; timezone: string; syncTwitch: boolean }>(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return { title: '', category: '', from: '', to: '', timezone: tz, syncTwitch: false };
  });
  const [catQuery, setCatQuery] = useState('');
  const [catResults, setCatResults] = useState<Array<{ id: string; name: string }>>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<{ title: string; category: string; from: string; to: string } | null>(null);
  // Chevauchements
  const overlapIds = useMemo(() => {
    if (!schedule) return new Set<number>();
    const items = [...schedule].map(e => ({ id: e.id, start: new Date(e.start).getTime(), end: new Date(e.end).getTime() }))
      .sort((a,b)=>a.start-b.start);
    const overlapping = new Set<number>();
    for (let i=0;i<items.length;i++) {
      for (let j=i+1;j<items.length;j++) {
        if (items[j].start < items[i].end) { // overlap
          overlapping.add(items[i].id);
          overlapping.add(items[j].id);
        } else {
          break;
        }
      }
    }
    return overlapping;
  }, [schedule]);
  const addEntry = async () => {
    if (!form.title || !form.from || !form.to) return;
    // Alerte chevauchement potentiel avant envoi
    try {
      const nf = new Date(form.from).getTime();
      const nt = new Date(form.to).getTime();
      if (Number.isFinite(nf) && Number.isFinite(nt) && schedule) {
        const hasOverlap = schedule.some(e => {
          const s = new Date(e.start).getTime();
          const t = new Date(e.end).getTime();
          return Math.max(s, nf) < Math.min(t, nt);
        });
        if (hasOverlap) show('Attention: chevauchement détecté avec un créneau existant.', 'warning');
      }
    } catch {}
    try {
      await fetchJSON(`${API_BASE}/api/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, category: form.category || null, start: form.from, end: form.to, timezone: form.timezone || null, syncTwitch: form.syncTwitch }) });
      setForm(f => ({ ...f, title: '', category: '', from: '', to: '' }));
      show('Créneau ajouté', 'success');
      mutateSched();
    } catch (e) {
      show('Échec ajout créneau', 'error');
    }
  };
  const removeEntry = async (id: number) => {
    try {
      await fetchJSON(`${API_BASE}/api/schedule/${id}`, { method: 'DELETE' });
      show('Créneau supprimé', 'success');
      mutateSched();
    } catch (e) {
      show('Échec suppression créneau', 'error');
    }
  };
  const downloadICS = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/schedule/ics`, { credentials: 'include' });
      if (!res.ok) throw new Error('ICS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'schedule.ics';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      show('Échec export ICS', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Outils</h1>
      {/* Onglets */}
      <div className="tabbar -mb-2">
        <div className="flex gap-2">
          <button
            className={`tab ${tab==='utilitaires' ? 'tab-active' : ''}`}
            onClick={()=>switchTab('utilitaires')}
          >Utilitaires</button>
          <button
            className={`tab ${tab==='configuration' ? 'tab-active' : ''}`}
            onClick={()=>switchTab('configuration')}
          >Configuration</button>
        </div>
      </div>

      {tab === 'configuration' ? (
        <div className="space-y-6">
          {/* Paramètres Email */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Paramètres email</div>
              <a href={`${API_BASE}/auth/twitch/rescope?redirect=${encodeURIComponent('/tools')}`} className="btn btn-muted text-sm">Re-consent Twitch</a>
            </div>
            {me ? (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <div className="text-sm text-muted">Adresse email</div>
                  <input defaultValue={me.email || ''} id="email-input" placeholder="votre@email" className="input w-72" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-brand" defaultChecked={!!me.recapEmailEnabled} id="recap-toggle" />
                  <span>Recevoir le récap à la fin du stream</span>
                </label>
                <button
                  onClick={async ()=>{
                    const email = (document.getElementById('email-input') as HTMLInputElement)?.value.trim();
                    const enabled = (document.getElementById('recap-toggle') as HTMLInputElement)?.checked;
                    try {
                      await fetchJSON(`${API_BASE}/api/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email || null, recapEmailEnabled: !!enabled }) });
                      show('Paramètres mis à jour', 'success');
                      mutateMe();
                    } catch {
                      show('Échec de la mise à jour des paramètres', 'error');
                    }
                  }}
                  className="btn btn-brand"
                >Enregistrer</button>
              </div>
            ) : (
              <div className="text-gray-400">Chargement du profil…</div>
            )}
            <div className="text-xs text-muted">Astuce: L’email peut être prérempli via Twitch (scope user:read:email). Vous pouvez le modifier ici.</div>
          </div>
        </div>
      ) : (
        <>
      {/* Générateur de titres */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Générateur de titres</div>
          <div className="text-xs text-muted">Basé sur l’historique récent + mots-clés (optionnel)</div>
        </div>
        <div className="flex gap-2">
          <input value={keywords} onChange={e => setKeywords(e.target.value)}
            placeholder="Mots-clés…" className="flex-1 input px-3 py-2 outline-none" />
          <button onClick={generateLocal} className="btn btn-muted">Combiner mes mots</button>
        </div>
        {suggLoading ? (
          <div className="space-y-2">
            <Skeleton variant="card" className="h-8" />
            <Skeleton variant="card" className="h-8" />
          </div>
        ) : (
          <div>
            <div className="text-sm text-muted mb-2">Propositions:</div>
            {titles.length === 0 ? (
              <div className="text-muted">Aucune proposition pour le moment.</div>
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {titles.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Publicité non intrusive en bas de page */}
      <div className="pt-8">
        <Adsense slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEATURES_MID} />
      </div>

      {/* Planificateur */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Planificateur</div>
          <div className="flex items-center gap-2">
            <button onClick={downloadICS} className="btn btn-muted text-sm">Exporter ICS</button>
            <a href={`${API_BASE}/auth/twitch/rescope?redirect=${encodeURIComponent('/tools')}`} className="btn btn-muted text-sm">Re-consent Twitch</a>
          </div>
        </div>
        {schedule && overlapIds.size > 0 && (
          <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800 rounded px-3 py-2">
            {overlapIds.size} créneau(x) se chevauchent. Vérifiez vos horaires ci-dessous.
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="text-sm text-muted">Titre</div>
            <input value={form.title} onChange={e=>setForm(f=>({ ...f, title: e.target.value }))} className="input w-64" />
          </div>
          <div>
            <div className="text-sm text-muted">Catégorie</div>
            <div className="relative w-64">
              <input
                value={form.category}
                onChange={async e=>{
                  const val = e.target.value; setForm(f=>({ ...f, category: val })); setCatQuery(val);
                  if (val && val.length >= 2) {
                    try {
                      const res = await fetchJSON<{ items: { id: string; name: string }[] }>(`${API_BASE}/api/twitch/games?query=${encodeURIComponent(val)}`);
                      setCatResults(res.items);
                      setCatOpen(true);
                    } catch { setCatResults([]); setCatOpen(false); }
                  } else { setCatResults([]); setCatOpen(false); }
                }}
                onFocus={()=>{ if (catResults.length>0) setCatOpen(true); }}
                onBlur={()=>{ setTimeout(()=>setCatOpen(false), 150); }}
                placeholder="Rechercher un jeu…"
                className="input w-full"
              />
              {catOpen && catResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded shadow" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
                  {catResults.map(it => (
                    <div key={it.id} className="px-2 py-1 hover:bg-panel cursor-pointer" onMouseDown={()=>{
                      setForm(f=>({ ...f, category: it.name })); setCatOpen(false);
                    }}>{it.name}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm ml-2">
            <input type="checkbox" className="accent-brand" checked={form.syncTwitch} onChange={e=>setForm(f=>({ ...f, syncTwitch: e.target.checked }))} />
            <span>Sync Twitch</span>
          </label>
          <div>
            <div className="text-sm text-muted">Fuseau horaire</div>
            <input value={form.timezone} onChange={e=>setForm(f=>({ ...f, timezone: e.target.value }))} placeholder="Ex: Europe/Paris" className="input w-48" />
          </div>
          <div>
            <div className="text-sm text-muted">Du</div>
            <input type="datetime-local" value={form.from} onChange={e=>setForm(f=>({ ...f, from: e.target.value }))} className="input" />
          </div>
          <div>
            <div className="text-sm text-muted">Au</div>
            <input type="datetime-local" value={form.to} onChange={e=>setForm(f=>({ ...f, to: e.target.value }))} className="input" />
          </div>
          <button onClick={addEntry} className="ml-2 btn btn-brand">Ajouter</button>
        </div>

        {schedLoading ? (
          <div className="space-y-2">
            <Skeleton variant="card" className="h-10" />
            <Skeleton variant="card" className="h-10" />
          </div>
        ) : schedule && schedule.length > 0 ? (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-2 pr-4">Titre</th>
                  <th className="py-2 pr-4">Catégorie</th>
                  <th className="py-2 pr-4">Début</th>
                  <th className="py-2 pr-4">Fin</th>
                  <th className="py-2 pr-4 text-right">Durée</th>
                  <th className="py-2 pr-4 text-center">Twitch</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map(e => {
                  const baseStart = new Date(e.start);
                  const baseEnd = new Date(e.end);
                  const editing = editingId === e.id;
                  const row = editing ? (editRow ?? { title: e.title, category: e.category || '', from: e.start.slice(0,16), to: e.end.slice(0,16) }) : null;
                  const dispStart = editing && row ? new Date(row.from) : baseStart;
                  const dispEnd = editing && row ? new Date(row.to) : baseEnd;
                  const durMin = Math.max(0, Math.round((dispEnd.getTime() - dispStart.getTime())/60000));
                  const durStr = durMin >= 60 ? `${Math.floor(durMin/60)}h ${durMin%60}m` : `${durMin}m`;
                  const isOverlap = overlapIds.has(e.id);
                  const beginEdit = () => {
                    setEditingId(e.id);
                    setEditRow({ title: e.title, category: e.category || '', from: e.start.slice(0,16), to: e.end.slice(0,16) });
                  };
                  const onSave = async () => {
                    if (!row) return;
                    try {
                      const nf = new Date(row.from).getTime();
                      const nt = new Date(row.to).getTime();
                      if (!Number.isFinite(nf) || !Number.isFinite(nt) || nf >= nt) {
                        show('Plage invalide (Du doit être avant Au).', 'error');
                        return;
                      }
                      const hasOverlap = schedule.some(x => x.id !== e.id && Math.max(new Date(x.start).getTime(), nf) < Math.min(new Date(x.end).getTime(), nt));
                      if (hasOverlap) show('Attention: chevauchement détecté.', 'warning');
                      await fetchJSON(`${API_BASE}/api/schedule/${e.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: row.title, category: row.category || null, start: row.from, end: row.to }),
                      });
                      setEditingId(null);
                      setEditRow(null);
                      mutateSched();
                      show('Créneau mis à jour', 'success');
                    } catch (err) {
                      show('Échec de la mise à jour', 'error');
                    }
                  };
                  const onCancel = () => { setEditingId(null); setEditRow(null); };
                  return (
                  <tr key={e.id} className={`border-t ${isOverlap ? 'border-rose-700 bg-rose-900/10' : ''}`} style={{ borderColor: isOverlap ? undefined : 'var(--border)' }}>
                    <td className="py-2 pr-4">
                      {editing && row ? (
                        <input value={row.title} onChange={ev=>setEditRow(r=>({ ...(r as any), title: ev.target.value }))} className="input w-64" />
                      ) : e.title}
                    </td>
                    <td className="py-2 pr-4">
                      {editing && row ? (
                        <input value={row.category} onChange={ev=>setEditRow(r=>({ ...(r as any), category: ev.target.value }))} className="input w-48" />
                      ) : (e.category || '—')}
                    </td>
                    <td className="py-2 pr-4">
                      {editing && row ? (
                        <input type="datetime-local" value={row.from} onChange={ev=>setEditRow(r=>({ ...(r as any), from: ev.target.value }))} className="input" />
                      ) : dispStart.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      {editing && row ? (
                        <input type="datetime-local" value={row.to} onChange={ev=>setEditRow(r=>({ ...(r as any), to: ev.target.value }))} className="input" />
                      ) : dispEnd.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right">{durStr}</td>
                    <td className="py-2 pr-4 text-center">
                      {e.twitchSegmentId ? (
                        <span className="text-emerald-400 text-xs">✓ sync</span>
                      ) : (
                        editing ? null : <button onClick={async ()=>{
                          try {
                            await fetchJSON(`${API_BASE}/api/schedule/${e.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ syncTwitch: true }),
                            });
                            show('Synchronisation Twitch déclenchée', 'success');
                            mutateSched();
                          } catch (err: any) {
                            const msg = String(err?.message || '');
                            if (msg.includes('HTTP 401') || msg.includes('HTTP 403')) {
                              show('Autorisation Twitch manquante. Re-consentez les accès.', 'warning');
                            } else {
                              show('Échec de la synchronisation Twitch', 'error');
                            }
                          }
                        }} className="text-xs underline" style={{ color: 'var(--brand)' }}>Syncer</button>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right space-x-2">
                      {editing ? (
                        <>
                          <button onClick={onSave} className="btn btn-brand">Enregistrer</button>
                          <button onClick={onCancel} className="btn btn-muted">Annuler</button>
                        </>
                      ) : (
                        <>
                          <button onClick={beginEdit} className="btn btn-muted">Éditer</button>
                          <button onClick={()=>removeEntry(e.id)} className="btn btn-muted">Supprimer</button>
                        </>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-400">Aucun créneau planifié.</div>
        )}
      </div>

      {/* Mini calendrier hebdo */}
      <MiniWeekCalendar schedule={schedule || []} />
      </>
      )}
    </div>
  );
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  const js = x.getDay(); // 0=dim..6=sam
  const diff = (js + 6) % 7; // 0=lun
  x.setDate(x.getDate() - diff);
  return x;
}

function MiniWeekCalendar({ schedule }: { schedule: ScheduleEntry[] }) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const weekDays = useMemo(() => Array.from({length:7}, (_,i)=>{
    const d = new Date(weekStart); d.setDate(weekStart.getDate()+i); return d;
  }), [weekStart]);

  const moveWeek = (delta: number) => {
    setWeekStart(prev => { const n = new Date(prev); n.setDate(prev.getDate()+delta*7); return startOfWeek(n); });
  };

  // Préparer entrées par jour avec intersections
  type Block = { id: number; title: string; color: string; topPct: number; heightPct: number; timeLabel: string };
  const blocksByDay: Block[][] = useMemo(() => {
    const res: Block[][] = Array.from({length:7},()=>[]);
    const colors = ['#22d3ee','#a78bfa','#f472b6','#f59e0b','#10b981','#60a5fa'];
    schedule.forEach((e, idx) => {
      const s = new Date(e.start); const t = new Date(e.end);
      for (let i=0;i<7;i++) {
        const day = weekDays[i];
        const dayStart = new Date(day); dayStart.setHours(0,0,0,0);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate()+1);
        const interStart = new Date(Math.max(s.getTime(), dayStart.getTime()));
        const interEnd = new Date(Math.min(t.getTime(), dayEnd.getTime()));
        if (interEnd > interStart) {
          const minutesFromMidnight = interStart.getHours()*60 + interStart.getMinutes();
          const durationMin = Math.max(15, Math.round((interEnd.getTime()-interStart.getTime())/60000));
          const topPct = (minutesFromMidnight / (24*60)) * 100;
          const heightPct = (durationMin / (24*60)) * 100;
          const pad = (n: number)=>String(n).padStart(2,'0');
          const timeLabel = `${pad(interStart.getHours())}:${pad(interStart.getMinutes())}–${pad(interEnd.getHours())}:${pad(interEnd.getMinutes())}`;
          res[i].push({ id: e.id, title: e.title, color: colors[idx % colors.length], topPct, heightPct, timeLabel });
        }
      }
    });
    return res;
  }, [schedule, weekDays]);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Calendrier hebdo (mini)</div>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={()=>moveWeek(-1)} className="btn btn-muted px-2 py-1">⟵ Semaine -1</button>
          <button onClick={()=>setWeekStart(startOfWeek(new Date()))} className="btn btn-muted px-2 py-1">Cette semaine</button>
          <button onClick={()=>moveWeek(1)} className="btn btn-muted px-2 py-1">Semaine +1 ⟶</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((d, i) => (
          <div key={i} className="border-default rounded overflow-hidden">
            <div className="text-xs text-muted px-2 py-1 border-b" style={{ borderColor: 'var(--border)' }}>
              {d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </div>
            <div className="relative h-96" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 75%, transparent)' }}>
              {/* repères horaires */}
              {Array.from({length:24}).map((_,h)=>(
                <div key={h} className="absolute left-0 right-0" style={{ top: `${(h/24)*100}%`, borderTop: '1px dashed var(--border)' }} />
              ))}
              {blocksByDay[i].map((b, k) => (
                <div key={k} className="absolute left-1 right-1 rounded text-[10px] leading-tight p-1" style={{ top: `${b.topPct}%`, height: `${b.heightPct}%`, background: `${b.color}22`, border: '1px solid var(--border)' }} title={`${b.title}\n${b.timeLabel}`}>
                  <div className="truncate font-medium" title={b.title}>{b.title}</div>
                  <div className="text-muted">{b.timeLabel}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
