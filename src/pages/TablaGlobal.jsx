import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext.jsx'

export function useFriends() {
  const { session } = useAuth()
  const me = session.user.id
  const [friendIds, setFriendIds] = useState(new Set())

  const refresh = useCallback(async () => {
    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      supabase.from('friendships').select('friend_id').eq('user_id', me),
      supabase.from('friendships').select('user_id').eq('friend_id', me)
    ])
    const ids = new Set([
      ...((d1 || []).map(r => r.friend_id)),
      ...((d2 || []).map(r => r.user_id))
    ])
    setFriendIds(ids)
  }, [me])
  useEffect(() => { refresh() }, [refresh])

  const addFriend = async (otherId) => {
    // Solo insertamos nuestra fila; la otra persona nos ve por el select bidireccional
    const { error } = await supabase.from('friendships').insert({ user_id: me, friend_id: otherId })
    if (error) console.error('addFriend error:', error)
    refresh()
  }
  const removeFriend = async (otherId) => {
    // Borrar solo nuestra fila (RLS solo permite borrar las propias)
    await supabase.from('friendships').delete()
      .eq('user_id', me).eq('friend_id', otherId)
    // También intentar borrar la inversa si existe (fallará silenciosamente si la puso el otro)
    await supabase.from('friendships').delete()
      .eq('user_id', otherId).eq('friend_id', me)
    refresh()
  }
  return { friendIds, addFriend, removeFriend, me }
}

export default function TablaGlobal() {
  const [rows, setRows] = useState([])
  const { friendIds, addFriend, removeFriend, me } = useFriends()
  const { isAdmin, profile } = useAuth()
  const [matrixData, setMatrixData] = useState(null)
  const [lastFinishedOrder, setLastFinishedOrder] = useState(null)

  useEffect(() => {
    supabase.rpc('get_full_ranking')
      .then(({ data, error }) => {
        if (error) {
          // Fallback si la función no existe aún
          supabase.from('users').select('id, username, total_points')
            .order('total_points', { ascending: false })
            .then(({ data }) => setRows((data || []).map(r => ({ ...r, is_pending: false }))))
        } else {
          setRows(data || [])
        }
      })
  }, [])

  // Cargar matriz para todos los usuarios + último partido finalizado
  useEffect(() => {
    Promise.all([
      supabase.rpc('get_all_predictions'),
      supabase.from('matches').select('match_order, status').eq('status', 'finished').order('match_order', { ascending: false }).limit(1)
    ]).then(([{ data, error }, { data: fin }]) => {
      if (error || !data) { console.error(error); return }
      // Armar estructura: users (únicos), matchOrders (únicos), grid[username][match_order]
      const usersMap = new Map()
      const ordersSet = new Set()
      const grid = {}
      for (const r of data) {
        usersMap.set(r.username, r.user_id)
        ordersSet.add(r.match_order)
        if (!grid[r.username]) grid[r.username] = {}
        grid[r.username][r.match_order] = r.predicted_result
      }
      const users = Array.from(usersMap.keys()).sort()
      const matchOrders = Array.from(ordersSet).sort((a, b) => a - b)
      setMatrixData({ users, matchOrders, grid })
      if (fin && fin.length > 0) setLastFinishedOrder(fin[0].match_order)
    })
  }, [])

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-bold">Tabla de Posiciones</h2>
      <div className="rounded-xl overflow-hidden border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <th className="p-2 text-left">#</th>
              <th className="p-2 text-left">Usuario</th>
              <th className="p-2 text-right">Pts</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isMe = r.user_id === me
              const isFriend = friendIds.has(r.user_id)
              return (
                <tr key={r.user_id || r.username} className={`${isMe ? 'bg-emerald-900/40' : i%2 ? 'bg-slate-900' : 'bg-slate-800/50'}`}>
                  <td className="p-2">{i+1}</td>
                  <td className="p-2">
                    {r.username}{isMe && ' (vos)'}
                    {r.is_pending && <span className="ml-1 text-xs text-amber-400" title="Sin usuario asignado">📋</span>}
                  </td>
                  <td className="p-2 text-right font-bold">{r.total_points}</td>
                  <td className="p-2 text-right">
                    {!isMe && !r.is_pending && (
                      isFriend
                        ? <button onClick={()=>removeFriend(r.user_id)} className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-xs">✕</button>
                        : <button onClick={()=>addFriend(r.user_id)} className="px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs">+</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Matriz de pronósticos */}
      {matrixData && (
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-3">📋 Matriz de Pronósticos</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800">
                  <th className="p-1 text-left sticky left-0 bg-slate-800 z-10 min-w-[100px]">Usuario</th>
                  {matrixData.matchOrders.map(mo => {
                    const isLastFinished = mo === lastFinishedOrder
                    return (
                      <th key={mo} className={`p-0 text-center ${isLastFinished ? 'bg-emerald-900/50' : ''}`} style={{ width: '28px', minWidth: '28px' }}>
                        <div className="flex items-end justify-center h-16">
                          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '10px' }}
                            className={`whitespace-nowrap ${isLastFinished ? 'text-emerald-300 font-bold' : 'text-slate-400'}`}>
                            P{mo}
                          </span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {matrixData.users.map((username, i) => {
                  const isMyRow = username === profile?.username
                  const rowBg = isMyRow ? 'bg-emerald-900/40' : i % 2 ? 'bg-slate-900' : 'bg-slate-800/50'
                  return (
                    <tr key={username} className={rowBg}>
                      <td className={`p-1 font-semibold sticky left-0 z-10 whitespace-nowrap ${isMyRow ? 'bg-emerald-900/60 text-emerald-300' : 'bg-inherit'}`}>
                        {username}{isMyRow && ' (vos)'}
                      </td>
                      {matrixData.matchOrders.map(mo => {
                        const val = matrixData.grid[username]?.[mo]
                        const label = val === '1' ? 'L' : val === 'X' ? 'E' : val === '2' ? 'V' : ''
                        const color = val === '1' ? 'text-emerald-400' : val === 'X' ? 'text-amber-400' : val === '2' ? 'text-sky-400' : ''
                        const isLastFinished = mo === lastFinishedOrder
                        const cellBg = isLastFinished ? (isMyRow ? 'bg-emerald-800/50' : 'bg-emerald-900/30') : ''
                        return (
                          <td key={mo} className={`text-center font-bold ${color} ${cellBg}`} style={{ width: '28px', padding: '2px' }}>
                            {label}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
