import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { id, adminKey } = req.body

    // simple admin check
    if (adminKey !== 'CIT_ADMIN_98765') {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    const { error } = await supabase
        .from('confessions')
        .delete()
        .eq('id', id)

    if (error) {
        return res.status(500).json({ error: error.message })
    }

    return res.json({ success: true })
}
