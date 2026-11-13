import { useCallback, useEffect, useState } from 'react';

export type SwStatus = 'active' | 'registering' | 'unsupported' | 'blocked';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let currentSwStatus: SwStatus =
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? 'registering'
    : 'unsupported';
const swListeners = new Set<(status: SwStatus) => void>();

function notifySwStatus(status: SwStatus) {
  currentSwStatus = status;
  for (const listener of swListeners) {
    listener(status);
  }
}

export function getSwStatus(): SwStatus {
  return currentSwStatus;
}

export async function registerServiceWorker(): Promise<SwStatus> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    notifySwStatus('unsupported');
    return 'unsupported';
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (reg.active || reg.installing || reg.waiting) {
      notifySwStatus('active');
      return 'active';
    }
    notifySwStatus('active');
    return 'active';
  } catch {
    // Expected inside sandboxed iframes where Service Worker registration is restricted
    notifySwStatus('blocked');
    return 'blocked';
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [swStatus, setSwStatus] = useState<SwStatus>(currentSwStatus);

  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;

  useEffect(() => {
    swListeners.add(setSwStatus);
    setSwStatus(currentSwStatus);

    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true);

    if (isStandalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowIOSGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      swListeners.delete(setSwStatus);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }
    setShowIOSGuide((v) => !v);
  }, [deferredPrompt]);

  return {
    canPromptInstall: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
    swStatus,
  };
}
