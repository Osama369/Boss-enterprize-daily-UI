import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import axios from 'axios'
import {Provider} from "react-redux"
import store from './redux/store.js'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

const theme = createTheme({
  palette: { mode: 'light' },
});

// Central API base URL for production (Render) and optional local override.
// If VITE_API_URL is not set, axios keeps relative URLs and Vite proxy handles dev.
const apiBaseUrl = (import.meta.env.VITE_API_URL || '').trim();
if (apiBaseUrl) {
  axios.defaults.baseURL = apiBaseUrl;
}
axios.defaults.withCredentials = true;

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </StrictMode>
  </Provider>
)
