import SafirTool from './SafirTool'
import type { AoiTool } from '../types'

export const safirTool: AoiTool = {
  id: 'safir',
  path: 'safir',
  name: 'SAFIR',
  family: 'SAFIR',
  description: 'SAF consumption monitoring and distribution analytics.',
  Component: SafirTool,
}
