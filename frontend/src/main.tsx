import { createRoot } from 'react-dom/client';
import './i18n';
import './styles.css';
import App from './App';
import AuthGate from './AuthGate';
import {captureInvitation} from './invitation-links';

captureInvitation();

createRoot(document.getElementById('root')!).render(<AuthGate><App /></AuthGate>);
