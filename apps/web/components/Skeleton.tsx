"use client";
import React from 'react';

type SkeletonProps = {
  className?: string;
  variant?: 'line' | 'circle' | 'card';
};

export function Skeleton({ className = '', variant = 'line' }: SkeletonProps) {
  const base = 'animate-pulse skeleton';
  if (variant === 'circle') {
    return <div className={`${base} rounded-full ${className}`} />;
  }
  if (variant === 'card') {
    return <div className={`${base} rounded border border-default ${className}`} />;
  }
  return <div className={`${base} rounded ${className}`} />;
}
