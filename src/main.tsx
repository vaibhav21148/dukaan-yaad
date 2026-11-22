import '@fontsource/hind/500.css';
import '@fontsource/hind/600.css';
import '@fontsource/hind/700.css';
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/500.css';
import '@fontsource/mukta/700.css';
import '@fontsource/mukta-vaani/400.css';
import '@fontsource/mukta-vaani/700.css';
import '@fontsource/hind-vadodara/600.css';
import '@fontsource/hind-vadodara/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './i18n';
import './styles.css';

// Install prompt (Android Chrome): keep the event so Settings can offer "install".
let deferred: (Event & { prompt: () => Promise<void> }) | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as typeof deferred;
});
const installPrompt = () => (deferred ? () => void deferred?.prompt().finally(() => (deferred = null)) : null);

if (import.meta.env.PROD) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App installPrompt={installPrompt} />
  </StrictMode>,
);
