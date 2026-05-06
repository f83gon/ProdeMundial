import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useFriends } from './TablaGlobal.jsx'

export default function Amigos() {
  const { friendIds, removeFriend, me } = useFriends()
  const [rows, setRows] = useState([])

  useEffect(() => {
    const ids = Array.from(friendIds)
    const idsConmigo = [...ids, me]
    if (idsConmigo.length === 0) { setRows([]); return }
    supabase.from('users').select('id, username, total_points')
      .in('id', idsConmigo)
      .order('total_points', { ascending: false })
      .then(({ data }) => setRows(data || []))
  }, [friendIds, me])

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-bold">Tabla entre Amigos</h2>
      {rows.length <= 1 && (
        <p className="text-sm text-slate-400">Aún no agregaste amigos. Andá a la pestaña "Tabla" y tocá ➕.</p>
      )}
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
              const isMe = r.id === me
              return (
                <tr key={r.id} className={`${isMe ? 'bg-emerald-900/40' : i%2 ? 'bg-slate-900' : 'bg-slate-800/50'}`}>
                  <td className="p-2">{i+1}</td>
                  <td className="p-2">{r.username}{isMe && ' (vos)'}</td>
                  <td className="p-2 text-right font-bold">{r.total_points}</td>
                  <td className="p-2 text-right">
                    {!isMe && (
                      <button onClick={()=>removeFriend(r.id)} className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-xs">✕</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
