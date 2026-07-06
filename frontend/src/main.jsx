import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { WebSocketProvider } from './context/WebSocketContext.jsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

// SPA Redirect Fallback (avoids static hosting 404s on route refresh)
const params = new URLSearchParams(window.location.search);
const redirect = params.get("redirect");
if (redirect && redirect.startsWith("/")) {
    window.history.replaceState(null, "", redirect);
}
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </ToastProvider>
  </StrictMode>,
)


