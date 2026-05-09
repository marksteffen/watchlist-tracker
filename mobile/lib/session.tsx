import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface SessionContextValue {
  session: Session | null
  isLoading: boolean
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isLoading: true,
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        if (event === 'INITIAL_SESSION') {
          setIsLoading(false)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  return (
    <SessionContext.Provider value={{ session, isLoading }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
