import React from 'react'
import ReactDOM from 'react-dom/client'
import { getInitialDirection, getInitialLang } from './i18n'
import App from './App.tsx'
import './index.css'

document.documentElement.setAttribute('dir', getInitialDirection())
document.documentElement.setAttribute('lang', getInitialLang())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)





























