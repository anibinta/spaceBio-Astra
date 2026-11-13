import { CheckCircle2, Download, Share } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import type { Locale } from '../../i18n/labels';

interface PWAInstallButtonProps {
  locale: Locale;
}

export function PWAInstallButton({ locale }: PWAInstallButtonProps) {
  const {
    canPromptInstall,
    isInstalled,
    isIOS,
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
  } = usePWAInstall();

  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300 dark:border-cyan-800 bg-cyan-50/70 dark:bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-800 dark:text-cyan-300">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span>
          {locale === 'fr'
            ? 'Application installée (standalone)'
            : 'App installed (standalone)'}
        </span>
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-cyan-500 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-500"
      >
        {isIOS && !canPromptInstall ? (
          <Share className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
        ) : (
          <Download className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
        )}
        <span>
          {locale === 'fr' ? 'Installer l’application PWA' : 'Install PWA App'}
        </span>
      </button>

      {showIOSGuide && (
        <div
          role="note"
          className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-700 dark:text-slate-300 space-y-1 max-w-md"
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {locale === 'fr'
              ? 'Installation manuelle du navigateur'
              : 'Manual Browser Installation'}
          </p>
          <p>
            {isIOS
              ? locale === 'fr'
                ? 'Sur Safari iOS : touchez Partager puis « Sur l’écran d’accueil ».'
                : 'On iOS Safari: tap Share, then "Add to Home Screen".'
              : locale === 'fr'
                ? 'Dans Chrome/Edge : cliquez sur l’icône d’installation dans la barre d’adresse (ou menu ⋮ → Installer SpaceBio Atlas). En prévisualisation iframe, ouvrez l’application dans un onglet autonome.'
                : 'In Chrome/Edge: click the install icon in the address bar (or menu ⋮ → Install SpaceBio Atlas). In iframe previews, open the app in a standalone tab.'}
          </p>
          <button
            type="button"
            onClick={() => setShowIOSGuide(false)}
            className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400 hover:underline"
          >
            {locale === 'fr' ? 'Fermer' : 'Dismiss'}
          </button>
        </div>
      )}
    </div>
  );
}
