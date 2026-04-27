import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { StatusProvider } from './context/StatusContext.jsx'
import { UserProvider } from './context/UserContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import AnnouncementProvider from './components/announcement/AnnouncementProvider.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <StatusProvider>
          <UserProvider>
            <ToastProvider>
              <AnnouncementProvider>
                <App />
              </AnnouncementProvider>
            </ToastProvider>
          </UserProvider>
        </StatusProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
