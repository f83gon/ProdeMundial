// Supabase Edge Function: send-predictions-email
// Deploy: npx supabase functions deploy send-predictions-email
//
// Requiere configurar el secret RESEND_API_KEY:
//   npx supabase secrets set RESEND_API_KEY=re_xxxxxxxx
//
// Obtené tu API key gratis en https://resend.com (100 emails/día gratis)
// También configurá tu dominio o usá el de testing de Resend.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
// Cambiá este email por el dominio verificado en Resend o usá onboarding@resend.dev para testing
const FROM_EMAIL = 'Prode Mundial <onboarding@resend.dev>'

serve(async (req) => {
  try {
    const { to, username, html } = await req.json()

    if (!to || !html) {
      return new Response(JSON.stringify({ error: 'Faltan campos to/html' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: `⚽ Prode Mundial 2026 - Pronósticos de ${username || 'Usuario'}`,
        html
      })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend error:', data)
      return new Response(JSON.stringify({ error: data }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
