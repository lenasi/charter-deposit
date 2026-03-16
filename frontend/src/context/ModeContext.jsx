import { createContext, useContext, useState } from 'react'

const ModeContext = createContext(null)

export function ModeProvider({ children }) {
  const [mode, setModeState] = useState(
    () => localStorage.getItem('charterMode') || 'live'
  )

  const setMode = (m) => {
    localStorage.setItem('charterMode', m)
    setModeState(m)
  }

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  )
}

export function useMode() {
  return useContext(ModeContext)
}
