import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyAppearance } from './services/appearance';
import './styles.css';

// Tema/yazı ölçeğini ilk render'dan önce uygula — renk sıçraması olmasın
applyAppearance();

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
