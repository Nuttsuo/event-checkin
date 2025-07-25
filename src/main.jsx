import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Dialog } from 'primereact/dialog';
        
import './index.css'

import App from './App.jsx'
import 'primereact/resources/themes/lara-light-blue/theme.css'
import 'primereact/resources/primereact.min.css'
// import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css';
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
