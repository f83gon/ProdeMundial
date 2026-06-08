import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setProfile(null); return }
    supabase.from('users').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session])

  const signUp = async (email, password, username, nombre, apellido) => {
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { username, nombre, apellido } }
    })
    if (error) throw error
  }
  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }
  const signOut = async () => { await supabase.auth.signOut() }

  const isAdmin = profile?.is_admin === true
  const isApproved = profile?.is_approved === true

  const refreshProfile = async () => {
    if (!session?.user) return
    const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single()
    if (data) setProfile(data)
  }

  return (
    <AuthCtx.Provider value={{ session, profile, loading, isAdmin, isApproved, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
