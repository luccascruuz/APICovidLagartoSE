import { Router } from 'express'
import helmet from 'helmet'

const VERSAO = '5.34.1'
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${VERSAO}`
const SRI = {
  css: 'sha384-4c3vsE5f+trhFyHrFrLM1fFGUn531NIaC7dcqEWIJdoRQJ5CkJbSuSCwXLpaS1KF',
  js: 'sha384-XFYN47VzPiDY6qPtxYKg0nqUeW/upo20xf1j2SUE7gT/i35FJB4cuS/71Iegzk8Z',
}

function pagina(titulo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<link rel="stylesheet" href="${CDN}/swagger-ui.css" integrity="${SRI.css}" crossorigin="anonymous">
<style>body { margin: 0; } .swagger-ui .topbar { display: none; }</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="${CDN}/swagger-ui-bundle.js" integrity="${SRI.js}" crossorigin="anonymous"></script>
<script src="/docs/iniciar.js"></script>
</body>
</html>`
}

const INICIAR = `window.addEventListener('load', function () {
  window.SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui', deepLinking: true, tryItOutEnabled: true })
})
`

export function swaggerUiRoutes(titulo: string): Router {
  const router = Router()
  const html = pagina(titulo.replace(/[<>&"]/g, ''))

  router.use(
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: { scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'], styleSrc: ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"] },
    }),
  )
  router.get('/', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.type('html').send(html)
  })
  router.get('/iniciar.js', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.type('application/javascript').send(INICIAR)
  })
  return router
}
