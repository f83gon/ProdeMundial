import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext.jsx'

export default function Predicciones() {
  const { session, profile } = useAuth()
  const userId = session.user.id
  const [matches, setMatches] = useState([])
  const [preds, setPreds] = useState({}) // match_id -> '1'|'X'|'2'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const [showSummary, setShowSummary] = useState(false)
  const [emailSent, setEmailSent] = useState(null)
  const printRef = useRef(null)

  const load = async () => {
    setLoading(true)
    const [{ data: m, error: me }, { data: p, error: pe }] = await Promise.all([
      supabase.from('matches').select('*').order('match_order'),
      supabase.from('predictions').select('match_id, predicted_result').eq('user_id', userId)
    ])
    if (me) console.error('Error cargando matches:', me)
    if (pe) console.error('Error cargando predictions:', pe)
    console.log('Matches:', m?.length ?? 0, 'Predictions:', p?.length ?? 0)
    setMatches(m || [])
    setPreds(Object.fromEntries((p || []).map(x => [x.match_id, x.predicted_result])))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Próximo partido habilitado: el de menor match_order sin predicción
  const nextOrder = useMemo(() => {
    for (const m of matches) if (!preds[m.id]) return m.match_order
    return Infinity
  }, [matches, preds])

  const save = async (match, value) => {
    setError(null); setSaving(match.id)
    const { error } = await supabase.from('predictions').insert({
      user_id: userId, match_id: match.id, predicted_result: value
    })
    setSaving(null)
    if (error) { setError(error.message); return }
    const newPreds = { ...preds, [match.id]: value }
    setPreds(newPreds)

    // Si completó todos los 72 pronósticos, mostrar resumen y enviar email
    const totalPredicted = Object.keys(newPreds).length
    if (totalPredicted === 72) {
      setShowSummary(true)
      sendSummaryEmail(newPreds)
    }
  }

  const sendSummaryEmail = async (allPreds) => {
    try {
      const html = buildEmailHtml(allPreds)
      const { error } = await supabase.functions.invoke('send-predictions-email', {
        body: {
          to: session.user.email,
          username: profile?.username || '',
          html
        }
      })
      if (error) throw error
      setEmailSent(true)
    } catch (e) {
      console.error('Error enviando email:', e)
      setEmailSent(false)
    }
  }

  const buildEmailHtml = (allPreds) => {
    const rows = matches.map(m => {
      const pred = allPreds[m.id]
      const label = pred === '1' ? 'Local' : pred === 'X' ? 'Empate' : 'Visitante'
      const color = pred === '1' ? '#10b981' : pred === 'X' ? '#f59e0b' : '#3b82f6'
      return `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #334155">${m.match_order}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #334155">${m.home_team}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #334155">${m.away_team}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #334155">${m.match_date}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #334155;color:${color};font-weight:bold">${label}</td>
      </tr>`
    }).join('')
    return `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#0f172a;color:#e2e8f0;padding:24px;border-radius:16px">
        <h1 style="color:#10b981;text-align:center">⚽ Prode Mundial 2026</h1>
        <h2 style="text-align:center;color:#94a3b8">Pronósticos de ${profile?.username || 'Usuario'}</h2>
        <p style="text-align:center;color:#64748b;font-size:14px">${profile?.nombre || ''} ${profile?.apellido || ''} · ${session.user.email}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
          <thead>
            <tr style="background:#1e293b">
              <th style="padding:6px 8px;text-align:left;color:#94a3b8">#</th>
              <th style="padding:6px 8px;text-align:left;color:#94a3b8">Local</th>
              <th style="padding:6px 8px;text-align:left;color:#94a3b8">Visitante</th>
              <th style="padding:6px 8px;text-align:left;color:#94a3b8">Fecha</th>
              <th style="padding:6px 8px;text-align:left;color:#94a3b8">Pronóstico</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="text-align:center;color:#64748b;font-size:12px;margin-top:16px">Generado el ${new Date().toLocaleDateString('es-AR')}</p>
      </div>
    `
  }

  const handlePrint = () => {
    const w = window.open('', '_blank')
    w.document.write(`
      <html><head><title>Mis Pronósticos - Prode Mundial 2026</title>
      <style>body{margin:0;padding:20px;background:#0f172a}@media print{body{background:white} td,th{color:#000!important} h1,h2{color:#000!important} div{background:white!important;color:#000!important}}</style>
      </head><body>${buildEmailHtml(preds)}</body></html>
    `)
    w.document.close()
    w.print()
  }

  // Chequear si ya completó todo al cargar
  const allDone = matches.length === 72 && Object.keys(preds).length === 72

  if (loading) return <div className="p-4">Cargando...</div>

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-bold">Pronósticos</h2>

      {allDone && !showSummary && (
        <div className="bg-emerald-900/40 border border-emerald-600 rounded-xl p-4 text-center space-y-2">
          <div className="text-2xl">🎉</div>
          <div className="font-bold text-emerald-300">¡Completaste todos tus pronósticos!</div>
          <div className="flex gap-2 justify-center">
            <button onClick={() => setShowSummary(true)}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold">
              📋 Ver resumen
            </button>
            <button onClick={handlePrint}
              className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-sm font-semibold">
              🖨️ Imprimir
            </button>
          </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-600 max-w-2xl w-full my-8">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800 rounded-t-2xl z-10">
              <h3 className="font-bold text-lg">📋 Resumen de Pronósticos</h3>
              <div className="flex gap-2">
                <button onClick={handlePrint}
                  className="px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-xs font-semibold">
                  🖨️ Imprimir
                </button>
                <button onClick={() => setShowSummary(false)}
                  className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs">✕ Cerrar</button>
              </div>
            </div>
            {emailSent === true && (
              <div className="mx-4 mt-3 p-2 rounded bg-emerald-900/40 text-emerald-400 text-xs text-center">
                ✉️ Se envió un email con tus pronósticos a {session.user.email}
              </div>
            )}
            {emailSent === false && (
              <div className="mx-4 mt-3 p-2 rounded bg-amber-900/40 text-amber-400 text-xs text-center">
                ⚠️ No se pudo enviar el email. Podés imprimir o guardar como PDF.
              </div>
            )}
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-400 text-xs">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Local</th>
                    <th className="p-2 text-left">Visitante</th>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Pronóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map(m => {
                    const pred = preds[m.id]
                    const label = pred === '1' ? 'Local' : pred === 'X' ? 'Empate' : 'Visitante'
                    const color = pred === '1' ? 'text-emerald-400' : pred === 'X' ? 'text-amber-400' : 'text-sky-400'
                    return (
                      <tr key={m.id} className="border-t border-slate-700">
                        <td className="p-2">{m.match_order}</td>
                        <td className="p-2">{m.home_team}</td>
                        <td className="p-2">{m.away_team}</td>
                        <td className="p-2 text-xs text-slate-400">{m.match_date}</td>
                        <td className={`p-2 font-bold ${color}`}>{label}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-400">
        Predicción secuencial: completá el partido <b>#{Number.isFinite(nextOrder) ? nextOrder : '—'}</b> para habilitar el siguiente.
        Una vez guardado, no se puede editar.
      </p>
      {error && <div className="text-red-400 text-sm">{error}</div>}

      <ul className="space-y-2">
        {matches.map(m => {
          const myPred = preds[m.id]
          const locked = !!myPred
          const enabled = !locked && m.match_order === nextOrder
          return (
            <li key={m.id} className={`rounded-xl p-3 border ${locked ? 'bg-slate-800 border-slate-700' : enabled ? 'bg-slate-800 border-emerald-600' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
              <div className="flex justify-between text-xs text-slate-400">
                <span>#{m.match_order} · {m.match_day} {m.match_date}</span>
                <span>{m.match_time?.slice(0,5)}</span>
              </div>
              <div className="font-semibold my-1">{m.home_team} <span className="text-slate-500">vs</span> {m.away_team}</div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {['1','X','2'].map(opt => {
                  const active = myPred === opt
                  return (
                    <button key={opt}
                      disabled={!enabled || saving === m.id}
                      onClick={() => save(m, opt)}
                      className={`py-2 rounded font-bold text-sm
                        ${active ? 'bg-emerald-600 text-white' :
                          enabled ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-800 text-slate-500'}`}>
                      {opt === '1' ? `1 (${m.home_team.split(' ')[0]})` :
                       opt === 'X' ? 'X (Empate)' :
                       `2 (${m.away_team.split(' ')[0]})`}
                    </button>
                  )
                })}
              </div>
              {locked && <div className="mt-2 text-xs text-emerald-400">✔ Guardado: {myPred}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
