import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { Navigate } from 'react-router-dom'

export default function Login() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setInfo(null); setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password, username, nombre, apellido)
        setInfo('Cuenta creada. Revisá tu email si la confirmación está activada, o iniciá sesión.')
        setMode('login')
      }
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-slate-100">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-slate-800 p-6 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold text-center">Prode Mundial 2026</h1>
        <div className="flex rounded-lg overflow-hidden border border-slate-700 text-sm">
          <button type="button" onClick={() => setMode('login')}
            className={`flex-1 py-2 ${mode==='login' ? 'bg-emerald-600' : 'bg-slate-700'}`}>Login</button>
          <button type="button" onClick={() => setMode('signup')}
            className={`flex-1 py-2 ${mode==='signup' ? 'bg-emerald-600' : 'bg-slate-700'}`}>Registrarse</button>
        </div>

        {mode === 'signup' && (
          <>
          <input className="input" placeholder="Username" value={username}
                 onChange={e=>setUsername(e.target.value)} required />
          <input className="input" placeholder="Nombre" value={nombre}
                 onChange={e=>setNombre(e.target.value)} required />
          <input className="input" placeholder="Apellido" value={apellido}
                 onChange={e=>setApellido(e.target.value)} required />
          </>
        )}
        <input className="input" type="email" placeholder="Email" value={email}
               onChange={e=>setEmail(e.target.value)} required />
        <input className="input" type="password" placeholder="Contraseña" value={password}
               onChange={e=>setPassword(e.target.value)} required minLength={6} />

        {error && <div className="text-red-400 text-sm">{error}</div>}
        {info && <div className="text-emerald-400 text-sm">{info}</div>}

        <button disabled={busy} className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold">
          {busy ? '...' : (mode==='login' ? 'Ingresar' : 'Crear cuenta')}
        </button>

        <style>{`.input{width:100%;padding:.6rem .8rem;border-radius:.5rem;background:#0f172a;border:1px solid #334155;color:#e2e8f0}`}</style>
      </form>
    </div>
  )
}
