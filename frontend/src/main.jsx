import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { WebSocketProvider } from './context/WebSocketContext.jsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <WebSocketProvider>
        <App />
      </WebSocketProvider>
    </ToastProvider>
  </StrictMode>,
)


