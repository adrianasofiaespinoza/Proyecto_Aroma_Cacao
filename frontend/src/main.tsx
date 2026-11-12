import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/theme.css'
import './styles/tenants/aroma-cacao.css'
import './styles/screens.css'
import { App } from './app/App'
import { AuthProvider } from './app/AuthProvider'
import { ThemeProvider } from './app/ThemeProvider'
import { ToastProvider } from './components/ui'
import { isApiError } from './lib/errors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
