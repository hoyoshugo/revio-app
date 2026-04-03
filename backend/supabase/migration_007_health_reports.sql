-- ============================================================
-- MIGRACIÓN 007: System Guardian — Reportes de salud
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS system_health_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Estado global del sistema
  status        VARCHAR(20) NOT NULL DEFAULT 'healthy',
  -- healthy | warning | critical

  -- Contadores
  critical_count  INTEGER DEFAULT 0,
  warning_count   INTEGER DEFAULT 0,
  ok_count        INTEGER DEFAULT 0,

  -- Hallazgos estructurados por categoría
  findings        JSONB DEFAULT '{}',
  -- {
  --   "security":     [{ "level": "critical|warning|ok", "file": "...", "line": N, "description": "...", "fix": "..." }],
  --   "performance":  [...],
  --   "functionality":[...],
  --   "code_quality": [...]
  -- }

  -- Texto completo del reporte (para mostrar en dashboard)
  report_text     TEXT,

  -- Duración de la evaluación en segundos
  duration_seconds DECIMAL(6,2),

  -- Metadatos
  triggered_by    VARCHAR(50) DEFAULT 'manual',
  -- manual | scheduled | hook | auto_session

  -- Seguimiento de recurrencia
  recurring_issues JSONB DEFAULT '[]',
  -- [{ "issue_key": "...", "occurrences": N, "first_seen": "...", "last_seen": "..." }]

  -- Si se enviaron notificaciones
  whatsapp_alert_sent BOOLEAN DEFAULT false,
  alert_sent_at       TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_reports_status ON system_health_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_reports_created ON system_health_reports(created_at DESC);

-- ============================================================
-- Vista: Último reporte + tendencia
-- ============================================================
CREATE OR REPLACE VIEW v_health_summary AS
SELECT
  r.id,
  r.status,
  r.critical_count,
  r.warning_count,
  r.ok_count,
  r.findings,
  r.report_text,
  r.triggered_by,
  r.whatsapp_alert_sent,
  r.created_at,
  -- Tendencia: comparar con el reporte anterior
  LAG(r.status) OVER (ORDER BY r.created_at) AS previous_status,
  LAG(r.critical_count) OVER (ORDER BY r.created_at) AS previous_critical_count
FROM system_health_reports r
ORDER BY r.created_at DESC;
