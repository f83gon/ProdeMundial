import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Partidos() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('matches').select('*').order('match_order')
      .then(({ data, error }) => {
        if (error) console.error('Error cargando partidos:', error)
        console.log('Partidos recibidos:', data?.length ?? 0)
        setMatches(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-4">Cargando partidos...</div>
  if (!matches.length) return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Partidos</h2>
      <p className="text-amber-400 text-sm">No se encontraron partidos. Verificá que hayas ejecutado <code>01_schema.sql</code> y <code>02_seed.sql</code> en Supabase SQL Editor, y que RLS esté configurado.</p>
    </div>
  )

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-bold">Partidos</h2>
      <ul className="space-y-2">
        {matches.map(m => (
          <li key={m.id} className="rounded-xl p-3 bg-slate-800 border border-slate-700">
            <div className="flex justify-between text-xs text-slate-400">
              <span>#{m.match_order} · {m.match_day} {m.match_date}</span>
              <span>{m.match_time?.slice(0,5)}</span>
            </div>
            <div className="font-semibold my-1">{m.home_team} <span className="text-slate-500">vs</span> {m.away_team}</div>
            <div className="text-sm">
              {m.status === 'finished'
                ? <span className="text-emerald-400">Resultado final: <b>{m.home_goals} - {m.away_goals}</b> ({m.actual_result})</span>
                : m.status === 'in_progress'
                ? <span className="text-amber-400">En desarrollo: <b>{m.home_goals} - {m.away_goals}</b></span>
                : <span className="text-slate-400">Pendiente</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
