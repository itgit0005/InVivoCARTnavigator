import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Bindings } from './lib/types'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboards'
import { adminRoutes } from './routes/admin'
import { aiRoutes } from './routes/ai'
import { exportRoutes } from './routes/export'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

app.route('/api/auth', authRoutes)
app.route('/api/dashboards', dashboardRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/ai', aiRoutes)
app.route('/api/export', exportRoutes)

app.get('/api/health', (c) => c.json({ ok: true, service: 'InVivo CAR-T Intelligence Platform' }))

app.use('/static/*', serveStatic({ root: './public' }))

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>In Vivo CAR-T Intelligence Platform</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
<link href="/static/style.css" rel="stylesheet">
</head>
<body class="bg-slate-50 text-slate-800" style="font-family:'Inter',sans-serif;">
  <div id="app"></div>
  <script src="/static/js/api.js"></script>
  <script src="/static/js/state.js"></script>
  <script src="/static/js/ui-helpers.js"></script>
  <script src="/static/js/login.js"></script>
  <script src="/static/js/shell.js"></script>
  <script src="/static/js/page-executive.js"></script>
  <script src="/static/js/page-module-table.js"></script>
  <script src="/static/js/page-clinical.js"></script>
  <script src="/static/js/page-catalysts.js"></script>
  <script src="/static/js/page-dataquality.js"></script>
  <script src="/static/js/page-monthly.js"></script>
  <script src="/static/js/page-ai.js"></script>
  <script src="/static/js/page-admin-upload.js"></script>
  <script src="/static/js/page-admin-review.js"></script>
  <script src="/static/js/page-admin-versions.js"></script>
  <script src="/static/js/page-admin-users.js"></script>
  <script src="/static/js/page-admin-audit.js"></script>
  <script src="/static/js/page-admin-sources.js"></script>
  <script src="/static/js/router.js"></script>
  <script src="/static/js/main.js"></script>
</body>
</html>`

app.get('*', (c) => c.html(INDEX_HTML))

export default app
