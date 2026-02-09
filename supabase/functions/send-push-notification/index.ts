// Supabase Edge Function: send-push-notification
// Web Push 通知送信用 Edge Function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// VAPID keys from environment
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'

// Web Push using native fetch (Deno compatible)
async function sendPushNotification(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: object
) {
    const encoder = new TextEncoder()
    const payloadBytes = encoder.encode(JSON.stringify(payload))

    // Note: This is a simplified implementation
    // For production, use a proper web-push library or implement full VAPID signing

    const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
        },
        body: payloadBytes,
    })

    return response.ok
}

serve(async (req) => {
    try {
        const { user_ids, title, body, url, tag } = await req.json()

        if (!user_ids || !Array.isArray(user_ids)) {
            return new Response(JSON.stringify({ error: 'user_ids array required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Create Supabase client with service role
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get push subscriptions for specified users
        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .in('user_id', user_ids)

        if (error) {
            throw error
        }

        const payload = {
            title: title || 'サークル結',
            body: body || '新しい通知があります',
            url: url || '/home',
            tag: tag || 'notification',
        }

        // Send notifications (simplified - for production use proper encryption)
        const results = await Promise.allSettled(
            subscriptions.map((sub) =>
                sendPushNotification(
                    { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                    payload
                )
            )
        )

        const success = results.filter((r) => r.status === 'fulfilled').length
        const failed = results.filter((r) => r.status === 'rejected').length

        return new Response(
            JSON.stringify({
                success: true,
                sent: success,
                failed,
                total: subscriptions.length
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
})
