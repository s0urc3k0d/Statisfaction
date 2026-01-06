"use client";
import { useState, ReactNode } from 'react';

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && (
        <span className="absolute z-20 -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap bg-gray-900 border border-gray-800 text-gray-200 text-xs px-2 py-1 rounded shadow">
          {content}
        </span>
      )}
    </span>
  );
}
