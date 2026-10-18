import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import NotifyHost from './components/NotifyHost';
import './index.css';
import { initThemeFromStorage } from './lib/theme.ts';

initThemeFromStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <NotifyHost />
    </ErrorBoundary>
  </StrictMode>,
);
