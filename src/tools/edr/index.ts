import EDRTool from './EDRTool'
import type { AoiTool } from '../types'

export const edrTool: AoiTool = {
  id: 'edr-app',
  path: 'edr',
  name: 'EDR App',
  family: 'EDR',
  description: 'Explore Flight Pulse catalogs as an interactive data model graph.',
  Component: EDRTool,
}
