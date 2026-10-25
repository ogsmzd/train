import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/big-shoulders-display'
import '@fontsource-variable/atkinson-hyperlegible-next'
import './index.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Ask the browser to keep our data even under storage pressure.
navigator.storage?.persist?.().catch(() => {})
