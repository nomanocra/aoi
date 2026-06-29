import { edrTool } from './edr'
import { safirTool } from './safir'
import type { AoiTool } from './types'

export const aoiTools = [safirTool, edrTool] satisfies AoiTool[]

export const defaultToolId = safirTool.id

export function resolveAoiTool(hash: string): AoiTool {
  const requestedToolId = hash.replace(/^#\/?/, '').split('/')[0]
  return aoiTools.find((tool) => tool.id === requestedToolId) ?? safirTool
}
