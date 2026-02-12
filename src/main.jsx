import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {Provider} from "react-redux"
import store from './redux/store.js'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

const theme = createTheme({
  palette: { mode: 'light' },
});

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
