"use client";
import type { ReactNode } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { useState } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      {/* Mobile sidebar */}
      <div className="md:hidden">
  <button onClick={() => setOpen(true)} className="m-3 inline-flex items-center gap-2 rounded px-3 py-2" style={{ border: '1px solid var(--border)', backgroundColor: 'color-mix(in oklab, var(--panel) 85%, transparent)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          Menu
        </button>
        {open && (
          <div className="fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 shadow-xl" style={{ backgroundColor: 'color-mix(in oklab, var(--panel) 85%, transparent)', borderRight: '1px solid var(--border)' }}>
              <div className="p-2 flex justify-end">
                <button onClick={() => setOpen(false)} className="h-8 w-8 inline-flex items-center justify-center rounded" style={{ border: '1px solid var(--border)' }}>✕</button>
              </div>
              <Sidebar />
            </div>
          </div>
        )}
      </div>
      <main className="flex-1 p-6 space-y-6 w-full">{children}</main>
    </div>
  );
}
