"use client";
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { API_BASE, fetchJSON, SessionResponse } from '../../../lib/api';

export default function RecapRedirectPage() {
  const router = useRouter();
  const { data: session } = useSWR<SessionResponse>(`${API_BASE}/auth/session`, fetchJSON);
  const { data, isLoading } = useSWR<any>(
    session?.authenticated ? `${API_BASE}/api/streams/last/recap` : null, 
    fetchJSON
  );
  useEffect(() => {
    if (data?.stream?.id) router.replace(`/recap/${data.stream.id}`);
  }, [data, router]);
  
  if (!session?.authenticated) {
    return <div className="text-gray-400">Connecte-toi pour voir tes récaps.</div>;
  }

  if (isLoading) {
    return <div className="text-gray-400">Chargement du dernier récap…</div>;
  }

  if (!data?.stream) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Récapitulatifs</h1>
        <div className="bg-gray-900/60 border border-gray-800 rounded p-6 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-400">Aucun stream enregistré pour le moment.</p>
          <p className="text-gray-500 text-sm mt-2">Lance un stream et les statistiques apparaîtront ici automatiquement.</p>
          <Link href="/dashboard" className="inline-block mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm">
            Retour au dashboard
          </Link>
        </div>
      </div>
    );
  }
  
  return <div className="text-gray-400">Chargement du dernier récap…</div>;
}
