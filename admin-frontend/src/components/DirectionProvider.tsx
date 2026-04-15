import { createContext, useContext, type ReactNode } from "react"
import { useDirection } from "../hooks/useDirection"

type Direction = "ltr" | "rtl"

interface DirectionContextValue {
  direction: Direction
  setDirection: (dir: Direction) => void
  isRtl: boolean
}

const DirectionContext = createContext<DirectionContextValue | undefined>(undefined)

export function DirectionProvider({ children }: { children: ReactNode }) {
  const value = useDirection()
  return (
    <DirectionContext.Provider value={value}>
      {children}
    </DirectionContext.Provider>
  )
}

export function useDirectionContext() {
  const context = useContext(DirectionContext)
  if (!context) {
    throw new Error("useDirectionContext must be used within a DirectionProvider")
  }
  return context
}
