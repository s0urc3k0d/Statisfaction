"use client";
import { useEffect, useMemo } from 'react';

export type AdsenseProps = {
  slot?: string;
  format?: 'auto' | 'fluid' | string;
  layout?: string; // e.g. in-article, responsive
  className?: string;
  style?: React.CSSProperties;
  fullWidth?: boolean;
  placeholderHeight?: number; // pour limiter le CLS
};

// Simple wrapper pour <ins class="adsbygoogle"> avec push() automatique.
export function Adsense({
  slot,
  format = 'auto',
  layout,
  className,
  style,
  fullWidth = true,
  placeholderHeight = 280,
}: AdsenseProps) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const enabled = !!client && typeof window !== 'undefined';
  const s = useMemo(() => ({ display: 'block', minHeight: placeholderHeight, ...(style || {}) }), [style, placeholderHeight]);

  useEffect(() => {
    if (!enabled) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [enabled, slot, format, layout]);

  if (!client) return null;
  return (
    <ins
      className={`adsbygoogle ${className || ''}`}
      style={s as any}
      data-ad-client={client}
      {...(slot ? { 'data-ad-slot': slot } : {})}
      {...(format ? { 'data-ad-format': format } : {})}
      {...(layout ? { 'data-ad-layout': layout } : {})}
      {...(fullWidth ? { 'data-full-width-responsive': 'true' } : {})}
    />
  );
}
