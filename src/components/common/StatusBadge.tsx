import { AlertTriangle, CheckCircle2, Disc, Minus } from 'lucide-react';
import type { EvidenceStatus } from '../../domain/types';
import { STATUS_LABELS, type Locale } from '../../i18n/labels';

interface StatusBadgeProps {
  status: EvidenceStatus;
  locale: Locale;
  compact?: boolean;
  inline?: boolean;
}

const STATUS_STYLES: Record<
  EvidenceStatus,
  {
    text: string;
    surface: string;
    glyph: string;
  }
> = {
  consensus: {
    text: 'text-cyan-800 dark:text-cyan-300',
    surface: 'bg-cyan-50/90 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-800',
    glyph: '✓',
  },
  contradiction: {
    text: 'text-rose-800 dark:text-rose-300',
    surface: 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800',
    glyph: '△',
  },
  single_replication: {
    text: 'text-amber-800 dark:text-amber-300',
    surface: 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800',
    glyph: '○',
  },
  empty: {
    text: 'text-slate-600 dark:text-slate-400',
    surface: 'bg-slate-100/80 dark:bg-slate-900/70 border-slate-300 dark:border-slate-700 border-dashed',
    glyph: '—',
  },
};

export function StatusBadge({
  status,
  locale,
  compact = false,
  inline = false,
}: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  const label = STATUS_LABELS[locale][status];

  const Icon =
    status === 'consensus'
      ? CheckCircle2
      : status === 'contradiction'
        ? AlertTriangle
        : status === 'single_replication'
          ? Disc
          : Minus;

  if (inline) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-semibold max-w-full ${style.text}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span aria-hidden="true" className="font-mono text-[11px] shrink-0">
          {style.glyph}
        </span>
        {!compact && <span className="truncate">{label}</span>}
        {compact && <span className="sr-only">{label}</span>}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${style.surface} ${style.text}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span aria-hidden="true" className="font-mono text-[11px]">
        {style.glyph}
      </span>
      {!compact && <span>{label}</span>}
      {compact && <span className="sr-only">{label}</span>}
    </span>
  );
}
