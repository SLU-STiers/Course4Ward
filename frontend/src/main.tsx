import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyThemeTokens } from './theme/tokens';
import './index.css';

// Project the canonical design tokens onto :root as --c4w-* variables.
applyThemeTokens();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
