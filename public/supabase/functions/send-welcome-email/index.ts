// Supabase Edge Function: send-welcome-email
// Deploy: npx supabase functions deploy send-welcome-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'Prode Mundial <onboarding@resend.dev>'

serve(async (req) => {
  try {
    const { to, nombre } = await req.json()

    if (!to) {
      return new Response(JSON.stringify({ error: 'Falta campo "to"' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px;">
  <div style="max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
    <h1 style="color: #10b981; text-align: center; margin-bottom: 8px;">🏆 ¡Bienvenido/a al Prode Mundial 2026!</h1>
    <p style="text-align: center; color: #94a3b8; font-size: 14px;">Hola <strong style="color: #f1f5f9;">${nombre || 'participante'}</strong>,</p>
    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
      Tu cuenta fue <strong style="color: #10b981;">aprobada</strong> por el administrador. 
      Ya podés ingresar al sitio y completar tus 72 pronósticos para la fase de grupos del Mundial 2026.
    </p>
    <div style="background: #0f172a; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">📌 Recordá:</p>
      <ul style="color: #cbd5e1; font-size: 13px; line-height: 1.8; padding-left: 20px; margin: 0;">
        <li>Los pronósticos son <strong>secuenciales</strong> (del partido 1 al 72)</li>
        <li>Una vez guardado un pronóstico, <strong>no se puede cambiar</strong></li>
        <li>Cada acierto vale <strong>1 punto</strong></li>
        <li>1 = Gana Local · X = Empate · 2 = Gana Visitante</li>
      </ul>
    </div>
    <p style="text-align: center; margin-top: 24px;">
      <a href="https://prode-mundial-2026.vercel.app" 
         style="display: inline-block; background: #10b981; color: #0f172a; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
        🎯 Ingresar al Prode
      </a>
    </p>
    <p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 24px;">
      ¡Buena suerte! ⚽
    </p>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: '🏆 ¡Tu cuenta del Prode Mundial 2026 fue aprobada!',
        html
      })
    })

    const result = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: result }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
