import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { ModeProvider, useMode } from './context/ModeContext.jsx'
import Book from './pages/Book.jsx'
import Admin from './pages/Admin.jsx'

// Both instances loaded once at startup — key={mode} on Elements forces reinit on switch
const stripeTest = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST || 'placeholder')
const stripeLive = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_LIVE || 'placeholder')

function BookWithStripe() {
  const { mode } = useMode()
  return (
    <Elements stripe={mode === 'test' ? stripeTest : stripeLive} key={mode}>
      <Book />
    </Elements>
  )
}

export default function App() {
  return (
    <ModeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/book" element={<BookWithStripe />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/book" replace />} />
        </Routes>
      </BrowserRouter>
    </ModeProvider>
  )
}
