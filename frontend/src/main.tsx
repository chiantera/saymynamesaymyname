import { createRoot } from 'react-dom/client';
import './i18n';
import './styles.css';
import App from './App';
import AuthGate from './AuthGate';

createRoot(document.getElementById('root')!).render(<AuthGate><App /></AuthGate>);
