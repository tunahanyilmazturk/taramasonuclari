import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyAppearance, bindSystemThemeListener } from './services/appearance';

// Tema/vurgu/yazı ölçeğini ilk render'dan önce uygula — renk sıçraması olmasın
applyAppearance();
bindSystemThemeListener();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);