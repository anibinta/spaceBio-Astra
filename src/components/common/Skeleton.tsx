export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800/80 ${className}`}
    />
  );
}

export function MatrixSkeleton() {
  return (
    <div className="space-y-3" aria-label="Chargement de la matrice">
      <SkeletonBlock className="h-8 w-64" />
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 20 }).map((_, idx) => (
          <SkeletonBlock key={idx} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
