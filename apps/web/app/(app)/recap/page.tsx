"use client";
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { API_BASE, fetchJSON } from '../../../lib/api';

export default function RecapRedirectPage() {
  const router = useRouter();
  const { data, isLoading } = useSWR<any>(`${API_BASE}/api/streams/last/recap`, fetchJSON);
  useEffect(() => {
    if (data?.stream?.id) router.replace(`/recap/${data.stream.id}`);
  }, [data, router]);
  return <div className="text-gray-400">Chargement du dernier récap…</div>;
}
