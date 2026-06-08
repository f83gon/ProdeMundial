import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePushNotifications } from '../hooks/usePushNotifications.js'

const baseTabs = [
  { to: '/predicciones', label: 'Pronósticos', icon: '🎯' },
  { to: '/partidos',     label: 'Partidos',    icon: '⚽' },
  { to: '/tabla',        label: 'Tabla',       icon: '🏆' },
  { to: '/amigos',       label: 'Amigos',      icon: '👥' },
  { to: '/stats',        label: 'Stats',       icon: '📊' }
]
const adminTab = { to: '/admin', label: 'Admin', icon: '⚙️' }

export default function Layout() {
  const { profile, isAdmin, isApproved, signOut } = useAuth()
  const { subscribed, subscribe, unsubscribe, supported } = usePushNotifications()
  const tabs = isAdmin ? [...baseTabs, adminTab] : baseTabs
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      {!isApproved && !isAdmin && (
        <div className="bg-amber-900/60 text-amber-200 text-xs text-center py-1.5 px-2">
          ⏳ Tu cuenta está pendiente de aprobación. Solo podés ver los partidos.
        </div>
      )}
      <header className="px-4 py-3 flex justify-between items-center border-b border-slate-700 bg-slate-950 sticky top-0 z-10">
        <div>
          <div className="font-bold text-lg leading-tight">Prode Mundial 2026</div>
          <div className="text-xs text-slate-400">
            {profile?.username ?? '...'} · {profile?.total_points ?? 0} pts
          </div>
        </div>
        <div className="flex items-center gap-2">
          {supported && (
            <button
              onClick={subscribed ? unsubscribe : subscribe}
              className={`text-lg px-2 py-1 rounded ${subscribed ? 'text-emerald-400' : 'text-slate-500'}`}
              title={subscribed ? 'Notificaciones activadas' : 'Activar notificaciones'}>
              {subscribed ? '🔔' : '🔕'}
            </button>
          )}
          <button onClick={signOut} className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600">
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-slate-950 border-t border-slate-700 flex justify-around">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to}
            className={({isActive}) =>
              `flex flex-col items-center py-2 text-xs ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
