import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { registerServiceWorker } from './hooks/usePWAInstall';
import './index.css';
import { bootstrapOfflineCache } from './services/dataAdapter';
import { measureInitialLoadMs } from './services/diagnostics';

void registerServiceWorker();
void bootstrapOfflineCache();

if (typeof window !== 'undefined') {
  window.addEventListener(
    'load',
    () => {
      measureInitialLoadMs();
    },
    { once: true },
  );
}

createRoot(document.getElementById('root')!).render(<App />);
