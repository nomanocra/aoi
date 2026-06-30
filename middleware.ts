/**
 * Vercel Edge Middleware — protège toute l'interface AOI par mot de passe (HTTP Basic Auth).
 *
 * Le mot de passe vient de la variable d'environnement SITE_PASSWORD (configurée sur Vercel).
 * Tant que SITE_PASSWORD n'est pas définie, le middleware laisse tout passer
 * (impossible de se verrouiller dehors par accident).
 */

export const config = {
  // Protège tout, sauf les ressources internes de Vercel.
  matcher: '/((?!_vercel/).*)',
}

const USERNAME = 'aoi'

export default function middleware(request: Request): Response | undefined {
  const password = process.env.SITE_PASSWORD

  // Pas de mot de passe configuré -> accès libre.
  if (!password) return undefined

  const expected = 'Basic ' + btoa(`${USERNAME}:${password}`)
  const provided = request.headers.get('authorization') ?? ''

  if (provided === expected) return undefined

  return new Response('Authentification requise.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="AOI", charset="UTF-8"',
    },
  })
}
