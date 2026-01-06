"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from './ThemeProvider';
import { useToast } from './Toast';
import useSWR from 'swr';
import { API_BASE, fetchJSON, SessionResponse } from '../lib/api';

export function Sidebar() {
  const router = useRouter();
  const { show } = useToast();
  const { data: session } = useSWR<SessionResponse>(`${API_BASE}/auth/session`, fetchJSON);
  const logout = async () => {
    try {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4100'}/auth/logout`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Logout failed');
      show('Déconnecté avec succès', 'success');
      router.push('/');
    } catch (e) {
      show('Échec de la déconnexion', 'error');
    }
  };
  return (
    <aside className="w-64 min-h-screen p-4 space-y-4" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 85%, transparent)', borderRight: '1px solid var(--border)' }}>
      <div className="text-xl font-semibold">Statisfaction</div>
      <nav className="space-y-2">
        <Link className="block hover:text-[var(--brand)]" href="/dashboard">Dashboard</Link>
        <Link className="block hover:text-[var(--brand)]" href="/history">Historique</Link>
        <Link className="block hover:text-[var(--brand)]" href="/compare">Comparer</Link>
        <Link className="block hover:text-[var(--brand)]" href="/analytics">Analytics</Link>
        <Link className="block hover:text-[var(--brand)]" href="/clips">🎬 Clips</Link>
        <Link className="block hover:text-[var(--brand)]" href="/compilation">🎞️ Compilations</Link>
        <Link className="block hover:text-[var(--brand)]" href="/giveaway">🎁 Giveaways</Link>
        <Link className="block hover:text-[var(--brand)]" href="/goals">🎯 Objectifs</Link>
        <Link className="block hover:text-[var(--brand)]" href="/notifications">🔔 Notifications</Link>
        <Link className="block hover:text-[var(--brand)]" href="/raid">Raids</Link>
        <Link className="block hover:text-[var(--brand)]" href="/tools">Outils</Link>
        <Link className="block hover:text-[var(--brand)]" href="/about">À propos</Link>
        <Link className="block hover:text-[var(--brand)]" href="/features">Fonctionnalités</Link>
        <Link className="block hover:text-[var(--brand)]" href="/privacy">Confidentialité</Link>
        {session?.user?.isAdmin && (
          <Link className="block hover:text-[var(--brand)]" href="/admin">Admin</Link>
        )}
      </nav>
      <div className="flex items-center gap-2">
        <button onClick={logout} className="text-sm" style={{ color: 'var(--text)' }}>Se déconnecter</button>
        <ThemeToggle compact />
      </div>
    </aside>
  );
}
