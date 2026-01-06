"use client";
import useSWR from 'swr';
import Link from 'next/link';
import { API_BASE, fetchJSON } from '../../../lib/api';
import { Skeleton } from '../../../components/Skeleton';

type StreamsList = { total: number; items: { id: number; title: string | null; category: string | null; startedAt: string; endedAt: string | null; durationMinutes: number; peakViewers: number; avgViewers: number }[] };

export default function HistoryPage() {
  const { data, error, isLoading } = useSWR<StreamsList>(`${API_BASE}/api/streams?limit=20&offset=0`, fetchJSON);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Historique</h1>
      {isLoading && (
        <div className="space-y-2">
          <Skeleton variant="card" className="h-16" />
          <Skeleton variant="card" className="h-16" />
          <Skeleton variant="card" className="h-16" />
        </div>
      )}
      {error && <div className="text-red-400">Erreur de chargement.</div>}
      {data && (
        <div className="space-y-2">
          {data.items.length === 0 ? (
            <div className="text-gray-400">Aucun stream trouvé.</div>
          ) : (
            data.items.map((s) => (
              <Link key={s.id} href={`/history/${s.id}`} className="block bg-gray-900/60 border border-gray-800 rounded p-4 hover:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.title || 'Sans titre'}</div>
                    <div className="text-sm text-gray-400">{s.category || 'Catégorie inconnue'} • {new Date(s.startedAt).toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-gray-300">{s.durationMinutes} min • pic {s.peakViewers} • moy {s.avgViewers}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
