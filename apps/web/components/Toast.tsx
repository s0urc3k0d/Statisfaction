"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type ToastItem = { id: string; type: ToastType; message: string; duration?: number; actionLabel?: string; onAction?: () => void };

const ToastCtx = createContext<{
  toasts: ToastItem[];
  show: (message: string, type?: ToastType, duration?: number, action?: { label: string; onClick: () => void }) => void;
  remove: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const remove = useCallback((id: string) => setToasts(t => t.filter(x => x.id !== id)), []);
  const show = useCallback((message: string, type: ToastType = 'info', duration = 3500, action?: { label: string; onClick: () => void }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, type, message, duration, actionLabel: action?.label, onAction: action?.onClick }]);
    if (duration) {
      setTimeout(() => remove(id), duration);
    }
  }, [remove]);
  const value = useMemo(() => ({ toasts, show, remove }), [toasts, show, remove]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed z-50 bottom-4 right-4 space-y-2">
        {toasts.map(t => (
          <ToastView key={t.id} item={t} onClose={() => remove(t.id)} />)
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastView({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const colors = item.type === 'success' ? 'bg-emerald-600/90' : item.type === 'error' ? 'bg-rose-600/90' : item.type === 'warning' ? 'bg-amber-600/90' : 'bg-slate-700/90';
  const border = item.type === 'success' ? 'border-emerald-500/70' : item.type === 'error' ? 'border-rose-500/70' : item.type === 'warning' ? 'border-amber-500/70' : 'border-slate-600/70';
  return (
    <div className={`text-sm text-white px-3 py-2 rounded border ${border} ${colors} shadow-md flex items-start gap-2 max-w-xs`}>
      <div className="pt-[2px]">
        {item.type === 'success' ? '✅' : item.type === 'error' ? '⛔' : item.type === 'warning' ? '⚠️' : 'ℹ️'}
      </div>
      <div className="flex-1">{item.message}</div>
      {item.actionLabel && item.onAction && (
        <button onClick={() => { try { item.onAction?.(); } finally { onClose(); } }} className="ml-2 px-2 py-1 text-xs bg-black/20 rounded border border-white/20 hover:bg-black/30">
          {item.actionLabel}
        </button>
      )}
      <button onClick={onClose} className="opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}
