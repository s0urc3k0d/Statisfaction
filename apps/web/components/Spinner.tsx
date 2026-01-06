export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-block w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin ${className}`} />
  );
}
