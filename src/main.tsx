import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import RouteScrollToTop from './components/ui/RouteScrollToTop'
import AppErrorBoundary from './components/ui/AppErrorBoundary'
import './index.css'
import 'leaflet/dist/leaflet.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <RouteScrollToTop />
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
)

