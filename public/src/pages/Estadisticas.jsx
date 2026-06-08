import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext.jsx'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// Definición de grupos del Mundial 2026 (12 grupos × 4 equipos), inferidos del fixture.
const GROUPS = {
  A: ['MEXICO','SUDAFRICA','COREA','REP. CHECA'],
  B: ['CANADA','BOSNIA','ESTADOS UNIDOS','PARAGUAY'],
  C: ['QATAR','SUIZA','BRASIL','MARRUECOS'], // ajustar si difiere
  D: ['HAITI','ESCOCIA','AUSTRALIA','TURQUIA'],
  E: ['ALEMANIA','CURAZAO','PAISES BAJOS','JAPON'],
  F: ['COSTA DE MARFIL','ECUADOR','SUECIA','TUNEZ'],
  G: ['ESPAÑA','CABO VERDE','ARABIA SAUDITA','URUGUAY'],
  H: ['BELGICA','EGIPTO','IRAN','NUEVA ZELANDA'],
  I: ['FRANCIA','SENEGAL','IRAK','NORUEGA'],
  J: ['ARGENTINA','ARGELIA','AUSTRIA','JORDANIA'],
  K: ['PORTUGAL','CONGO','UZBEKISTAN','COLOMBIA'],
  L: ['INGLATERRA','CROACIA','GHANA','PANAMA']
}
const teamGroup = {}
for (const [g, teams] of Object.entries(GROUPS)) for (const t of teams) teamGroup[t] = g

const COLORS = ['#10b981', '#f59e0b', '#3b82f6']

export default function Estadisticas() {
  const { session } = useAuth()
  const userId = session.user.id
  const [matches, setMatches] = useState([])
  const [myPreds, setMyPreds] = useState([]) // {match_id, predicted_result}
  const [consensus, setConsensus] = useState([]) // {match_id, votes_1, votes_x, votes_2, votes_total}
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: p }, { data: c }] = await Promise.all([
        supabase.from('matches').select('*').order('match_order'),
        supabase.from('predictions').select('match_id, predicted_result').eq('user_id', userId),
        supabase.from('match_consensus').select('*')
      ])
      setMatches(m || [])
      setMyPreds(p || [])
      setConsensus(c || [])
      setLoading(false)
    })()
  }, [userId])

  const matchById = useMemo(() => Object.fromEntries(matches.map(m => [m.id, m])), [matches])
  const consById  = useMemo(() => Object.fromEntries(consensus.map(c => [c.match_id, c])), [consensus])
  const predByMatch = useMemo(() => Object.fromEntries(myPreds.map(p => [p.match_id, p.predicted_result])), [myPreds])

  // Distribución 1/X/2 del usuario
  const distribution = useMemo(() => {
    const c = { '1': 0, 'X': 0, '2': 0 }
    myPreds.forEach(p => { c[p.predicted_result]++ })
    return [
      { name: 'Local (1)', value: c['1'] },
      { name: 'Empate (X)', value: c['X'] },
      { name: 'Visitante (2)', value: c['2'] }
    ]
  }, [myPreds])

  // Simulador de grupos: 3 pts por victoria, 1 por empate, 0 por derrota.
  // Solo se usan partidos de fase de grupos (match_order 1..72 - acá todos lo son).
  const groupTables = useMemo(() => {
    const tables = {}
    for (const [g, teams] of Object.entries(GROUPS)) {
      tables[g] = Object.fromEntries(teams.map(t => [t, { team: t, pj: 0, pg: 0, pe: 0, pp: 0, pts: 0 }]))
    }
    for (const p of myPreds) {
      const m = matchById[p.match_id]; if (!m) continue
      const g = teamGroup[m.home_team] || teamGroup[m.away_team]
      if (!g || !tables[g]?.[m.home_team] || !tables[g]?.[m.away_team]) continue
      const home = tables[g][m.home_team], away = tables[g][m.away_team]
      home.pj++; away.pj++
      if (p.predicted_result === '1') { home.pg++; away.pp++; home.pts += 3 }
      else if (p.predicted_result === '2') { away.pg++; home.pp++; away.pts += 3 }
      else { home.pe++; away.pe++; home.pts++; away.pts++ }
    }
    const out = {}
    for (const g of Object.keys(GROUPS)) {
      out[g] = Object.values(tables[g]).sort((a,b) => b.pts - a.pts || b.pg - a.pg)
    }
    return out
  }, [myPreds, matchById])

  // Top 5 coincidentes / diferenciales
  const consensusRanking = useMemo(() => {
    const items = []
    for (const p of myPreds) {
      const m = matchById[p.match_id]
      const c = consById[p.match_id]
      if (!m || !c || !c.votes_total) continue
      const votesFor = p.predicted_result === '1' ? c.votes_1 : p.predicted_result === 'X' ? c.votes_x : c.votes_2
      const pct = votesFor / c.votes_total
      items.push({ match: m, pred: p.predicted_result, pct, votes: votesFor, total: c.votes_total })
    }
    const top = [...items].sort((a,b) => b.pct - a.pct).slice(0, 5)
    const dif = [...items].sort((a,b) => a.pct - b.pct).slice(0, 5)
    return { top, dif }
  }, [myPreds, matchById, consById])

  // Rachas
  const streaks = useMemo(() => {
    // Recorremos partidos finalizados en orden cronológico
    const finished = matches.filter(m => m.status === 'finished')
    let best = 0, cur = 0, current = 0, lastWasHit = null
    for (const m of finished) {
      const myP = predByMatch[m.id]
      if (!myP) { cur = 0; continue }
      if (myP === m.actual_result) { cur++; if (cur > best) best = cur }
      else cur = 0
    }
    // Racha actual: contar desde el último partido finalizado hacia atrás
    for (let i = finished.length - 1; i >= 0; i--) {
      const m = finished[i]
      const myP = predByMatch[m.id]
      if (myP && myP === m.actual_result) current++
      else break
    }
    return { current, best }
  }, [matches, predByMatch])

  if (loading) return <div className="p-4">Cargando...</div>

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold">Estadísticas</h2>

      <Card title="Distribución de tus pronósticos">
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={distribution} dataKey="value" nameKey="name" outerRadius={90} label>
                {distribution.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Rachas">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-slate-900 rounded-xl">
            <div className="text-3xl font-bold text-emerald-400">{streaks.current}</div>
            <div className="text-xs text-slate-400">Racha actual</div>
          </div>
          <div className="p-4 bg-slate-900 rounded-xl">
            <div className="text-3xl font-bold text-amber-400">{streaks.best}</div>
            <div className="text-xs text-slate-400">Mejor racha</div>
          </div>
        </div>
      </Card>

      <Card title="Top 5 coincidentes">
        <ConsensusList items={consensusRanking.top} />
      </Card>

      <Card title="Top 5 diferenciales">
        <ConsensusList items={consensusRanking.dif} />
      </Card>

      <Card title="Simulador de grupos (según tus pronósticos)">
        <div className="grid sm:grid-cols-2 gap-3">
          {Object.entries(groupTables).map(([g, table]) => (
            <div key={g} className="bg-slate-900 rounded-xl p-3">
              <div className="font-bold mb-1">Grupo {g}</div>
              <table className="w-full text-xs">
                <thead className="text-slate-400">
                  <tr><th className="text-left">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>Pts</th></tr>
                </thead>
                <tbody>
                  {table.map(t => (
                    <tr key={t.team} className="border-t border-slate-800">
                      <td className="py-1">{t.team}</td>
                      <td className="text-center">{t.pj}</td>
                      <td className="text-center">{t.pg}</td>
                      <td className="text-center">{t.pe}</td>
                      <td className="text-center">{t.pp}</td>
                      <td className="text-center font-bold">{t.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <section className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </section>
  )
}

function ConsensusList({ items }) {
  if (!items.length) return <div className="text-sm text-slate-400">Sin datos aún.</div>
  return (
    <ul className="space-y-2">
      {items.map(({ match: m, pred, pct, votes, total }) => (
        <li key={m.id} className="bg-slate-900 rounded-lg p-2 text-sm flex justify-between items-center">
          <div>
            <div className="font-semibold">{m.home_team} vs {m.away_team}</div>
            <div className="text-xs text-slate-400">Tu pick: <b>{pred}</b> · {votes}/{total} jugadores</div>
          </div>
          <div className="text-emerald-400 font-bold">{(pct*100).toFixed(0)}%</div>
        </li>
      ))}
    </ul>
  )
}
