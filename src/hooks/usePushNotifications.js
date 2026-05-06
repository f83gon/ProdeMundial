import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext.jsx'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushNotifications() {
  const { session } = useAuth()
  const [permission, setPermission] = useState(Notification.permission)
  const [subscribed, setSubscribed] = useState(false)

  const subscribe = async () => {
    if (!session?.user) return false

    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return false

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        })
      }

      const subJson = sub.toJSON()

      // Save to Supabase
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: session.user.id,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth
      }, { onConflict: 'user_id,endpoint' })

      if (error) { console.error('Error saving push sub:', error); return false }
      setSubscribed(true)
      return true
    } catch (err) {
      console.error('Push subscription error:', err)
      return false
    }
  }

  // Auto-subscribe on mount if supported and not yet subscribed
  useEffect(() => {
    if (!session?.user || !('serviceWorker' in navigator) || !('PushManager' in window)) return

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        setSubscribed(true)
      } else {
        // Auto-request permission and subscribe
        subscribe()
      }
    })
  }, [session])

  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await supabase.from('push_subscriptions').delete()
          .eq('user_id', session.user.id)
          .eq('endpoint', sub.endpoint)
      }
      setSubscribed(false)
    } catch (err) {
      console.error('Unsubscribe error:', err)
    }
  }

  return { permission, subscribed, subscribe, unsubscribe, supported: 'PushManager' in window }
}
