import SafirTool from './SafirTool'
import type { AoiTool } from '../types'

export const safirTool: AoiTool = {
  id: 'safir',
  name: 'SAFIR',
  productLine: 'Airline Operations Intelligence',
  description: 'SAF consumption monitoring and distribution analytics.',
  route: '#safir',
  Component: SafirTool,
}
