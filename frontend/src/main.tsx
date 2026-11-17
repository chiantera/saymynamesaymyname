import { createRoot } from 'react-dom/client';
import './i18n';
// Shared styles first, then one file per screen. Keep this order.
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/shell.css';
import './styles/home.css';
import './styles/sharing.css';
import './styles/relationships.css';
import './styles/settings.css';
import './styles/ai-settings.css';
import './styles/auth.css';
import './styles/placeholders.css';
import App from './App';
import AuthGate from './AuthGate';
import { captureInvitation } from './invitation-links';

captureInvitation();

createRoot(document.getElementById('root')!).render(
  <AuthGate>
    <App />
  </AuthGate>,
);
