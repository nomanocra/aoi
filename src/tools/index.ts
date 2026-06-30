import { edrTool } from './edr'
import { safirTool } from './safir'
import type { AoiFamily, AoiFamilyId, AoiRoute, AoiTool } from './types'

export const aoiFamilies = [
  {
    id: 'SAFIR',
    name: 'SAFIR',
    tagline: 'Sustainable fuel intelligence',
    description: 'Track SAF consumption, distribution and emissions across the network.',
  },
  {
    id: 'EDR',
    name: 'EDR',
    tagline: 'Enterprise data registry',
    description: 'Explore data catalogs and their relationships as interactive models.',
  },
] as const satisfies readonly AoiFamily[]

export const aoiTools = [safirTool, edrTool] satisfies AoiTool[]

export function homePath(): string {
  return '/'
}

export function toolPath(tool: AoiTool): string {
  return `/${tool.path}`
}

export function toolsForFamily(familyId: AoiFamilyId): AoiTool[] {
  return aoiTools.filter((tool) => tool.family === familyId)
}

function parsePath(pathname: string): string[] {
  return pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

/**
 * Resolves a URL pathname into a route:
 *   /        -> home (landing with all tools)
 *   /safir   -> the SAFIR tool
 *   /edr     -> the EDR tool
 * Unknown paths fall back to the home page.
 */
export function resolveAoiRoute(pathname: string): AoiRoute {
  const [slug] = parsePath(pathname)

  if (!slug) return { type: 'home' }

  const tool = aoiTools.find((item) => item.path === slug)
  if (tool) return { type: 'tool', tool }

  return { type: 'home' }
}
