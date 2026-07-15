import { createRoot } from 'react-dom/client';
import './theme.css';
import App from './App.jsx';

// Image cassée → placeholder visuel
window.addEventListener('error', function (e) {
  const el = e.target;
  if (el && el.tagName === 'IMG') { el.classList.add('fb-broken'); el.removeAttribute('src'); }
}, true);

createRoot(document.getElementById('root')).render(<App />);
