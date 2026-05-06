import { useAuth } from '../context/AuthContext.jsx'

export default function RequireApproval({ children }) {
  const { isApproved } = useAuth()

  if (!isApproved) {
    return (
      <div className="p-6 text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h2 className="text-xl font-bold text-amber-400">Cuenta pendiente de aprobación</h2>
        <p className="text-slate-400 text-sm max-w-xs mx-auto">
          Tu cuenta fue creada correctamente pero el administrador todavía no la aprobó.
          Mientras tanto podés ver los partidos del Mundial.
        </p>
        <p className="text-slate-500 text-xs">
          Recibirás un email cuando tu cuenta sea aprobada.
        </p>
      </div>
    )
  }

  return children
}
