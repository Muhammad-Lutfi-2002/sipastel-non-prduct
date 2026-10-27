import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalErrorLogging } from './utils/clientErrorLog';
import { initSentry } from './lib/sentry';
import './index.css';

// Must run before anything else can throw.
initSentry();
installGlobalErrorLogging();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Outermost boundary: catches anything, including a failure inside
        ThemeProvider itself. Its fallback intentionally uses plain inline
        styles, not Tailwind/theme classes, so it renders even if those
        never loaded. */}
    <ErrorBoundary boundaryName="root">
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
