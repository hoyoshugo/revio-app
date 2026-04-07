// backend/src/routes/sync.js
// Endpoint para trigger manual de sincronizacion OTA
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { syncPropertyICal, syncAllProperties } from '../services/icalSync.js'

const router = Router()

// POST /api/sync/ical - sincronizar todas las propiedades
router.post('/ical', requireAuth, async (req, res) => {
    res.json({ success: true, message: 'Sync iniciado en background' })
    try {
        const results = await syncAllProperties()
        console.log(JSON.stringify({
            level: 'info', event: 'manual_sync_completed', results,
        }))
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error', event: 'manual_sync_failed', error: err.message,
        }))
    }
})

// POST /api/sync/ical/:slug - sincronizar una propiedad especifica
router.post('/ical/:slug', requireAuth, async (req, res) => {
    const { slug } = req.params
    const { property_id } = req.body
    if (!property_id) return res.status(400).json({ error: 'property_id requerido' })

    res.json({ success: true, message: `Sync de ${slug} iniciado` })
    try {
        const results = await syncPropertyICal(slug, property_id)
        console.log(JSON.stringify({
            level: 'info', event: 'manual_property_sync_completed', slug, results,
        }))
    } catch (err) {
        console.error(JSON.stringify({
            level: 'error', event: 'manual_property_sync_failed', slug, error: err.message,
        }))
    }
})

export default router
