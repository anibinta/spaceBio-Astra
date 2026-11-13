import { Download } from 'lucide-react';
import type { Locale } from '../../i18n/labels';

interface CsvExportButtonProps {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | boolean | null | undefined>>;
  locale: Locale;
  label?: string;
}

function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function CsvExportButton({
  filename,
  headers,
  rows,
  locale,
  label,
}: CsvExportButtonProps) {
  const handleExport = () => {
    const csvLines = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buttonText =
    label ?? (locale === 'fr' ? 'Exporter CSV' : 'Export CSV');

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
    >
      <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{buttonText}</span>
    </button>
  );
}
