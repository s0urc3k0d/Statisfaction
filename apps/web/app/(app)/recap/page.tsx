"use client";
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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
  
  return <div className="text-gray-400">Chargement du dernier récap…</div>;
}
