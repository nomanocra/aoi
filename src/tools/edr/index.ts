import EDRTool from './EDRTool'
import type { AoiTool } from '../types'

export const edrTool: AoiTool = {
  id: 'edr-app',
  name: 'EDR App',
  productLine: 'Airline Operations Intelligence',
  description: 'Empty EDR workspace shell.',
  route: '#edr-app',
  Component: EDRTool,
}
