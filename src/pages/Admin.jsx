import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext.jsx'
import { Navigate } from 'react-router-dom'
import * as XLSX from 'xlsx'

export default function Admin() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('partidos')

  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-bold">⚙️ Administración</h2>

      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'partidos', label: '⚽ Partidos' },
          { id: 'usuarios', label: '👥 Usuarios' },
          { id: 'importar', label: '📥 Importar' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${tab === t.id ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'partidos' && <AdminPartidos />}
      {tab === 'usuarios' && <AdminUsuarios />}
      {tab === 'importar' && <AdminImportar />}
    </div>
  )
}

// ========== TAB: PARTIDOS ==========
function AdminPartidos() {
  const [matches, setMatches] = useState([])
  const [consensus, setConsensus] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [msg, setMsg] = useState(null)
  const [goals, setGoals] = useState({})
  const [expanded, setExpanded] = useState(null)
  const [detailPreds, setDetailPreds] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('matches').select('*').order('match_order'),
      supabase.from('match_consensus').select('*')
    ]).then(([{ data: m }, { data: c }]) => {
      setMatches(m || [])
      const g = {}
      for (const match of (m || [])) {
        g[match.id] = { home: match.home_goals ?? '', away: match.away_goals ?? '' }
      }
      setGoals(g)
      const con = {}
      for (const row of (c || [])) con[row.match_id] = row
      setConsensus(con)
      setLoading(false)
    })
  }, [])

  const toggleDetail = async (matchId) => {
    if (expanded === matchId) { setExpanded(null); return }
    const { data } = await supabase.rpc('get_match_predictions', { p_match_id: matchId })
    setDetailPreds(data || [])
    setExpanded(matchId)
  }

  const updateGoals = async (match) => {
    const g = goals[match.id]
    const home = parseInt(g.home, 10)
    const away = parseInt(g.away, 10)
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      setMsg({ id: match.id, text: 'Ingresá goles válidos (>=0)', ok: false }); return
    }
    setSaving(match.id)
    const { error } = await supabase.from('matches')
      .update({ home_goals: home, away_goals: away, status: 'in_progress' })
      .eq('id', match.id)
    setSaving(null)
    if (error) { setMsg({ id: match.id, text: error.message, ok: false }); return }
    setMsg({ id: match.id, text: 'Goles guardados · En desarrollo', ok: true })
    setMatches(prev => prev.map(m => m.id === match.id ? { ...m, home_goals: home, away_goals: away, status: 'in_progress' } : m))
  }

  const finishMatch = async (match) => {
    const g = goals[match.id]
    const home = parseInt(g.home, 10)
    const away = parseInt(g.away, 10)
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      setMsg({ id: match.id, text: 'Cargá los goles antes de finalizar', ok: false }); return
    }
    if (!confirm(`¿Finalizar partido #${match.match_order} ${match.home_team} ${home} - ${away} ${match.away_team}?`)) return
    setSaving(match.id)
    const { error } = await supabase.from('matches')
      .update({ home_goals: home, away_goals: away, status: 'finished' })
      .eq('id', match.id)
    setSaving(null)
    if (error) { setMsg({ id: match.id, text: error.message, ok: false }); return }
    const result = home > away ? '1' : away > home ? '2' : 'X'
    setMsg({ id: match.id, text: `Finalizado → ${result}. Puntos recalculados. Enviando notificaciones...`, ok: true })
    setMatches(prev => prev.map(m => m.id === match.id ? { ...m, home_goals: home, away_goals: away, status: 'finished', actual_result: result } : m))

    // Enviar push notifications
    try {
      // Obtener ranking actualizado con posiciones previas
      const { data: usersData } = await supabase.from('users')
        .select('id, username, total_points')
        .order('total_points', { ascending: false })

      const rankings = (usersData || []).map((u, i) => ({
        user_id: u.id,
        username: u.username,
        total_points: u.total_points,
        position: i + 1,
        prev_position: null // TODO: could store previous positions
      }))

      await supabase.functions.invoke('send-push-notifications', {
        body: {
          match: { ...match, home_goals: home, away_goals: away, actual_result: result },
          rankings
        }
      })
    } catch (e) { console.error('Error enviando push notifications:', e) }
  }

  if (loading) return <div className="p-4">Cargando...</div>

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Cargá los goles y finalizá cada partido para calcular puntos.</p>
      <ul className="space-y-3">
        {matches.map(m => {
          const g = goals[m.id] || { home: '', away: '' }
          const finished = m.status === 'finished'
          const feedback = msg?.id === m.id ? msg : null
          const con = consensus[m.id]
          const isExpanded = expanded === m.id
          return (
            <li key={m.id} className={`rounded-xl p-4 border ${finished ? 'bg-slate-800 border-slate-700' : 'bg-slate-800 border-slate-600'}`}>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>#{m.match_order} · {m.match_day} {m.match_date}</span>
                <span>{m.match_time?.slice(0,5)}</span>
              </div>
              <div className="flex items-center gap-2 my-2">
                <span className="flex-1 text-right font-semibold text-sm">{m.home_team}</span>
                <input type="number" min="0" disabled={finished}
                  className="w-14 text-center py-1 rounded bg-slate-900 border border-slate-600 text-white font-bold"
                  value={g.home}
                  onChange={e => setGoals(prev => ({ ...prev, [m.id]: { ...prev[m.id], home: e.target.value } }))} />
                <span className="text-slate-500 font-bold">-</span>
                <input type="number" min="0" disabled={finished}
                  className="w-14 text-center py-1 rounded bg-slate-900 border border-slate-600 text-white font-bold"
                  value={g.away}
                  onChange={e => setGoals(prev => ({ ...prev, [m.id]: { ...prev[m.id], away: e.target.value } }))} />
                <span className="flex-1 font-semibold text-sm">{m.away_team}</span>
              </div>

              {con && con.votes_total > 0 && (
                <div className="flex gap-3 text-xs text-slate-400 my-2 justify-center flex-wrap">
                  <span className="bg-slate-900 px-2 py-1 rounded">🏠 Local: <b className="text-emerald-400">{con.votes_1}</b> ({Math.round(con.votes_1/con.votes_total*100)}%)</span>
                  <span className="bg-slate-900 px-2 py-1 rounded">🤝 Empate: <b className="text-amber-400">{con.votes_x}</b> ({Math.round(con.votes_x/con.votes_total*100)}%)</span>
                  <span className="bg-slate-900 px-2 py-1 rounded">✈️ Visitante: <b className="text-sky-400">{con.votes_2}</b> ({Math.round(con.votes_2/con.votes_total*100)}%)</span>
                </div>
              )}

              {finished ? (
                <div className="text-emerald-400 text-xs font-semibold">✔ Finalizado · {m.home_goals} - {m.away_goals} · Resultado: {m.actual_result}</div>
              ) : (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => updateGoals(m)} disabled={saving === m.id}
                    className="flex-1 py-2 rounded bg-sky-700 hover:bg-sky-600 text-xs font-semibold">
                    {saving === m.id ? '...' : '💾 Guardar goles'}
                  </button>
                  <button onClick={() => finishMatch(m)} disabled={saving === m.id}
                    className="flex-1 py-2 rounded bg-amber-700 hover:bg-amber-600 text-xs font-semibold">
                    {saving === m.id ? '...' : '🏁 Finalizar partido'}
                  </button>
                </div>
              )}

              <button onClick={() => toggleDetail(m.id)} className="mt-2 text-xs text-sky-400 hover:text-sky-300 underline">
                {isExpanded ? '▲ Ocultar pronósticos' : '▼ Ver pronósticos por usuario'}
              </button>

              {isExpanded && (
                <div className="mt-2 bg-slate-900 rounded-lg p-3">
                  {detailPreds.length === 0 ? (
                    <p className="text-xs text-slate-400">Ningún usuario pronosticó este partido aún.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="text-slate-400">
                        <tr><th className="text-left pb-1">Usuario</th><th className="text-center pb-1">Pronóstico</th>{finished && <th className="text-center pb-1">Acierto</th>}</tr>
                      </thead>
                      <tbody>
                        {detailPreds.map(p => (
                          <tr key={p.user_id} className="border-t border-slate-800">
                            <td className="py-1">{p.username}</td>
                            <td className="text-center font-bold">
                              <span className={p.predicted_result === '1' ? 'text-emerald-400' : p.predicted_result === 'X' ? 'text-amber-400' : 'text-sky-400'}>
                                {p.predicted_result === '1' ? 'Local' : p.predicted_result === 'X' ? 'Empate' : 'Visitante'}
                              </span>
                            </td>
                            {finished && <td className="text-center">{p.predicted_result === m.actual_result ? '✅' : '❌'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {feedback && <div className={`mt-2 text-xs ${feedback.ok ? 'text-emerald-400' : 'text-red-400'}`}>{feedback.text}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ========== TAB: USUARIOS ==========
function AdminUsuarios() {
  const [users, setUsers] = useState([])
  const [predCounts, setPredCounts] = useState({}) // user_id -> count
  const [pendingSets, setPendingSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  const load = async () => {
    const [{ data: u }, { data: pp }] = await Promise.all([
      supabase.from('users').select('id, username, email, nombre, apellido, is_approved, is_admin, total_points').order('created_at'),
      supabase.from('pending_predictions').select('label, assigned_to, id')
    ])
    setUsers(u || [])
    console.log('pending_predictions rows:', pp?.length, pp)

    // Obtener conteo de predicciones por usuario (via RPC get_all_predictions)
    const { data: allPreds } = await supabase.rpc('get_all_predictions')
    const counts = {}
    for (const p of (allPreds || [])) {
      counts[p.user_id] = (counts[p.user_id] || 0) + 1
    }
    setPredCounts(counts)

    const sets = {}
    for (const row of (pp || [])) {
      const key = row.label
      if (!sets[key]) sets[key] = { label: key, count: 0, assigned_to: row.assigned_to }
      sets[key].count++
    }
    console.log('Parsed sets:', sets)
    setPendingSets(Object.values(sets))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const approveUser = async (user) => {
    setMsg(null)
    const { error } = await supabase.rpc('approve_user', { p_user_id: user.id })
    if (error) { setMsg({ text: error.message, ok: false }); return }

    // Enviar email de bienvenida
    try {
      await supabase.functions.invoke('send-welcome-email', {
        body: { to: user.email, nombre: user.nombre || user.username }
      })
    } catch (e) { console.error('Error enviando welcome email:', e) }

    setMsg({ text: `✅ ${user.username} aprobado. Email de bienvenida enviado.`, ok: true })
    load()
  }

  const assignPredictions = async (userId, label) => {
    setMsg(null)
    const { error } = await supabase.rpc('assign_predictions', { p_label: label, p_user_id: userId })
    if (error) { setMsg({ text: error.message, ok: false }); return }
    setMsg({ text: `✅ Pronósticos "${label}" asignados correctamente.`, ok: true })
    load()
  }

  const assignAndApprove = async (user, label) => {
    setMsg(null)
    // Primero asignar pronósticos
    const { error: e1 } = await supabase.rpc('assign_predictions', { p_label: label, p_user_id: user.id })
    if (e1) { setMsg({ text: e1.message, ok: false }); return }
    // Luego aprobar
    const { error: e2 } = await supabase.rpc('approve_user', { p_user_id: user.id })
    if (e2) { setMsg({ text: e2.message, ok: false }); return }
    // Enviar email
    try {
      await supabase.functions.invoke('send-welcome-email', {
        body: { to: user.email, nombre: user.nombre || user.username }
      })
    } catch (e) { console.error('Error enviando welcome email:', e) }
    setMsg({ text: `✅ Pronósticos "${label}" asignados y ${user.username} aprobado.`, ok: true })
    load()
  }

  if (loading) return <div>Cargando...</div>

  const pendingUsers = users.filter(u => !u.is_approved && !u.is_admin)
  const approvedUsers = users.filter(u => u.is_approved)
  const unassignedSets = pendingSets.filter(s => !s.assigned_to)

  return (
    <div className="space-y-4">
      {msg && <div className={`text-sm p-2 rounded ${msg.ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>{msg.text}</div>}

      {/* Usuarios pendientes de aprobación */}
      <div>
        <h3 className="font-bold text-amber-400 mb-2">⏳ Pendientes de aprobación ({pendingUsers.length})</h3>
        {pendingUsers.length === 0 ? (
          <p className="text-xs text-slate-400">No hay usuarios pendientes.</p>
        ) : (
          <ul className="space-y-2">
            {pendingUsers.map(u => {
              return (
              <li key={u.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-sm">{u.nombre} {u.apellido}</div>
                    <div className="text-xs text-slate-400">{u.username} · {u.email}</div>
                  </div>
                  <button onClick={() => approveUser(u)}
                    className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold">
                    ✓ Aprobar
                  </button>
                </div>
                {/* Asignar pronóstico importado */}
                {unassignedSets.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
                    <span className="text-xs text-slate-400">Asignar Excel:</span>
                    <select
                      className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value && confirm(`¿Asignar "${e.target.value}" a ${u.username} y aprobar la cuenta?`)) {
                          assignAndApprove(u, e.target.value)
                        }
                        e.target.value = ''
                      }}>
                      <option value="">-- Seleccionar set --</option>
                      {unassignedSets.map(s => (
                        <option key={s.label} value={s.label}>{s.label} ({s.count} partidos)</option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Usuarios aprobados - asignar pronósticos */}
      <div>
        <h3 className="font-bold text-emerald-400 mb-2">✅ Usuarios aprobados ({approvedUsers.length})</h3>
        <ul className="space-y-2">
          {approvedUsers.map(u => {
            const userPredCount = predCounts[u.id] || 0
            return (
              <li key={u.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-sm">{u.nombre} {u.apellido} {u.is_admin && '👑'}</div>
                    <div className="text-xs text-slate-400">
                      {u.username} · {u.total_points} pts · {userPredCount}/72 pronósticos
                    </div>
                  </div>
                  {!u.is_admin && userPredCount === 0 && unassignedSets.length > 0 && (
                    <select
                      className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value && confirm(`¿Asignar "${e.target.value}" a ${u.username}?`)) {
                          assignPredictions(u.id, e.target.value)
                        }
                        e.target.value = ''
                      }}>
                      <option value="">Asignar pronóstico...</option>
                      {unassignedSets.map(s => (
                        <option key={s.label} value={s.label}>{s.label} ({s.count} partidos)</option>
                      ))}
                    </select>
                  )}
                  {userPredCount === 72 && <span className="text-xs text-emerald-400">✓ Completo</span>}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ========== TAB: IMPORTAR ==========
function AdminImportar() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [pendingSets, setPendingSets] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('matches').select('id, match_order, home_team, away_team, match_date, match_time, match_day').order('match_order'),
      supabase.from('pending_predictions').select('label, assigned_to')
    ]).then(([{ data: m }, { data: pp }]) => {
      setMatches(m || [])
      const sets = {}
      for (const row of (pp || [])) {
        if (!sets[row.label]) sets[row.label] = { label: row.label, count: 0, assigned_to: row.assigned_to }
        sets[row.label].count++
      }
      setPendingSets(Object.values(sets))
      setLoading(false)
    })
  }, [])

  const downloadTemplate = () => {
    const rows = matches.map(m => ({
      '#': m.match_order,
      'Fecha': m.match_date,
      'Hora': m.match_time?.slice(0, 5),
      'Día': m.match_day || '',
      'Local': m.home_team,
      'Visitante': m.away_team,
      'Pronóstico (1/X/2)': ''
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 4 }, { wch: 12 }, { wch: 6 }, { wch: 12 },
      { wch: 20 }, { wch: 20 }, { wch: 18 }
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pronósticos')
    XLSX.writeFile(wb, 'Prode_Mundial_2026_Plantilla.xlsx')
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const label = prompt('Nombre para este set de pronósticos (ej: "Pronóstico de Juan"):')
    if (!label || !label.trim()) return

    setImporting(true)
    setMsg(null)

    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws)

      const predictions = []
      const errors = []

      for (const row of rows) {
        const order = row['#']
        const pred = String(row['Pronóstico (1/X/2)'] || '').trim().toUpperCase()

        if (!pred) { errors.push(`Fila #${order}: sin pronóstico`); continue }
        if (!['1', 'X', '2'].includes(pred)) { errors.push(`Fila #${order}: valor inválido "${pred}"`); continue }

        const match = matches.find(m => m.match_order === order)
        if (!match) { errors.push(`Fila #${order}: partido no encontrado`); continue }

        predictions.push({ label: label.trim(), match_id: match.id, predicted_result: pred })
      }

      if (errors.length > 0) {
        setMsg({ text: `Errores:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n...y ${errors.length - 10} más` : ''}`, ok: false })
        setImporting(false)
        return
      }

      if (predictions.length !== 72) {
        setMsg({ text: `Se encontraron ${predictions.length} pronósticos válidos, se necesitan 72.`, ok: false })
        setImporting(false)
        return
      }

      const { error } = await supabase.from('pending_predictions').insert(predictions)
      if (error) { setMsg({ text: error.message, ok: false }); setImporting(false); return }

      setMsg({ text: `✅ Set "${label.trim()}" importado con ${predictions.length} pronósticos. Ahora asignálo a un usuario en la pestaña Usuarios.`, ok: true })

      const { data: pp } = await supabase.from('pending_predictions').select('label, assigned_to')
      const sets = {}
      for (const row of (pp || [])) {
        if (!sets[row.label]) sets[row.label] = { label: row.label, count: 0, assigned_to: row.assigned_to }
        sets[row.label].count++
      }
      setPendingSets(Object.values(sets))
    } catch (err) {
      setMsg({ text: `Error leyendo archivo: ${err.message}`, ok: false })
    }
    setImporting(false)
    e.target.value = ''
  }

  const deleteSet = async (label) => {
    if (!confirm(`¿Eliminar el set "${label}"?`)) return
    await supabase.from('pending_predictions').delete().eq('label', label)
    setPendingSets(prev => prev.filter(s => s.label !== label))
    setMsg({ text: `Set "${label}" eliminado.`, ok: true })
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`text-sm p-3 rounded whitespace-pre-wrap ${msg.ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="font-bold mb-2">📋 Plantilla Excel</h3>
        <p className="text-xs text-slate-400 mb-3">
          Descargá la plantilla con los 72 partidos y enviásela a los participantes.
          Ellos completan la columna "Pronóstico (1/X/2)" con 1 (Local), X (Empate), o 2 (Visitante) y te la devuelven.
        </p>
        <button onClick={downloadTemplate}
          className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-sm font-semibold">
          ⬇️ Descargar Plantilla
        </button>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="font-bold mb-2">📥 Importar pronósticos desde Excel</h3>
        <p className="text-xs text-slate-400 mb-3">
          Subí el Excel completo. Se guardará como set pendiente hasta que lo asignes a un usuario en la pestaña "Usuarios".
        </p>
        <label className="inline-block px-4 py-2 rounded bg-amber-700 hover:bg-amber-600 text-sm font-semibold cursor-pointer">
          {importing ? 'Importando...' : '📂 Seleccionar archivo Excel'}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
        </label>
      </div>

      {pendingSets.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="font-bold mb-2">📦 Sets importados</h3>
          <ul className="space-y-2">
            {pendingSets.map(s => (
              <li key={s.label} className="flex justify-between items-center bg-slate-900 rounded p-2">
                <div>
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="text-xs text-slate-400 ml-2">({s.count} partidos)</span>
                  {s.assigned_to && <span className="text-xs text-emerald-400 ml-2">✓ Asignado</span>}
                </div>
                {!s.assigned_to && (
                  <button onClick={() => deleteSet(s.label)}
                    className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-xs">🗑️</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
