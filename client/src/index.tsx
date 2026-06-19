import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('找不到 #root 元素');
const root = createRoot(rootEl);
root.render(<App />);
