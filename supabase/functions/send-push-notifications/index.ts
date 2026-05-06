// Supabase Edge Function: send-push-notifications
// Deploy: npx supabase functions deploy send-push-notifications
//
// Secrets necesarios:
//   npx supabase secrets set VAPID_PRIVATE_KEY=PhjGVkWL7GITpLWVUMx8ePfbjxuyEnEheSfGa6CbEYo
//   npx supabase secrets set VAPID_PUBLIC_KEY=BJ410oXJOPYoZi0y8IyA3XsMBPFfY0Qf7HWc1eF8lntLIvBxof7_K9IKXOlNLuupFp3bjUE33Q1hchY3RkqZqyg
//   npx supabase secrets set VAPID_SUBJECT=mailto:f83gon@gmail.com

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:f83gon@gmail.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Web Push crypto utilities for Deno
async function generatePushHeaders(subscription: any) {
  // We'll use a simpler approach: call the web-push logic inline
  // For Deno Edge Functions, we use the fetch-based web push approach
  const vapidHeaders = await createVapidHeaders(subscription.endpoint)
  return vapidHeaders
}

async function createVapidHeaders(audience: string) {
  const urlObj = new URL(audience)
  const aud = `${urlObj.protocol}//${urlObj.host}`

  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT
  }

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const unsignedToken = `${headerB64}.${payloadB64}`

  // Import the private key
  const privateKeyRaw = base64UrlToArrayBuffer(VAPID_PRIVATE_KEY)
  const key = await crypto.subtle.importKey(
    'raw', privateKeyRaw,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  )

  const sigB64 = arrayBufferToBase64Url(signature)
  const jwt = `${unsignedToken}.${sigB64}`

  return {
    Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    TTL: '86400'
  }
}

function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(base64 + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function sendPushToSubscription(sub: any, payload: object): Promise<boolean> {
  try {
    const headers = await createVapidHeaders(sub.endpoint)
    const body = JSON.stringify(payload)

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Content-Encoding': 'aes128gcm'
      },
      body
    })

    // 410 = subscription expired, should remove
    if (res.status === 410 || res.status === 404) {
      return false // signal to remove subscription
    }
    return res.ok
  } catch {
    return false
  }
}

serve(async (req) => {
  try {
    const { match, rankings } = await req.json()
    // match: { match_order, home_team, away_team, home_goals, away_goals, actual_result, id }
    // rankings: [{ user_id, username, total_points, position, prev_position }]

    if (!match) {
      return new Response(JSON.stringify({ error: 'Falta campo match' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get all push subscriptions
    const { data: subs } = await supabase.from('push_subscriptions').select('*')
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No hay suscripciones' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get predictions for this match
    const { data: predictions } = await supabase
      .from('predictions')
      .select('user_id, predicted_result')
      .eq('match_id', match.id)

    const predByUser: Record<string, string> = {}
    for (const p of (predictions || [])) {
      predByUser[p.user_id] = p.predicted_result
    }

    // Build ranking lookup
    const rankingByUser: Record<string, any> = {}
    for (const r of (rankings || [])) {
      rankingByUser[r.user_id] = r
    }

    const resultText = match.actual_result === '1' ? 'Local' : match.actual_result === 'X' ? 'Empate' : 'Visitante'
    const scoreText = `${match.home_team} ${match.home_goals} - ${match.away_goals} ${match.away_team}`

    let sent = 0
    const toRemove: string[] = []

    for (const sub of subs) {
      const userPred = predByUser[sub.user_id]
      const ranking = rankingByUser[sub.user_id]

      let body = `⚽ ${scoreText}\nResultado: ${resultText}`

      if (userPred) {
        const acerto = userPred === match.actual_result
        body += `\n${acerto ? '✅ ¡Acertaste!' : '❌ No acertaste'}`
      }

      if (ranking) {
        const pos = ranking.position
        const prev = ranking.prev_position
        let posText = `📊 Posición: ${pos}°`
        if (prev && prev !== pos) {
          const diff = prev - pos
          posText += diff > 0 ? ` (subiste ${diff} 🔼)` : ` (bajaste ${Math.abs(diff)} 🔽)`
        }
        body += `\n${posText}`
      }

      const payload = {
        title: `🏁 Finalizó #${match.match_order}`,
        body,
        url: '/partidos'
      }

      const ok = await sendPushToSubscription(sub, payload)
      if (ok) sent++
      else toRemove.push(sub.id)
    }

    // Clean expired subscriptions
    if (toRemove.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', toRemove)
    }

    return new Response(JSON.stringify({ sent, total: subs.length, removed: toRemove.length }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
