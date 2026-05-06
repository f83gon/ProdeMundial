import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import RequireApproval from './components/RequireApproval.jsx'
import Login from './pages/Login.jsx'
import Predicciones from './pages/Predicciones.jsx'
import Partidos from './pages/Partidos.jsx'
import TablaGlobal from './pages/TablaGlobal.jsx'
import Amigos from './pages/Amigos.jsx'
import Estadisticas from './pages/Estadisticas.jsx'
import Admin from './pages/Admin.jsx'

function Protected({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-6">Cargando...</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Navigate to="/partidos" replace />} />
        <Route path="/predicciones" element={<RequireApproval><Predicciones /></RequireApproval>} />
        <Route path="/partidos" element={<Partidos />} />
        <Route path="/tabla" element={<RequireApproval><TablaGlobal /></RequireApproval>} />
        <Route path="/amigos" element={<RequireApproval><Amigos /></RequireApproval>} />
        <Route path="/stats" element={<RequireApproval><Estadisticas /></RequireApproval>} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
