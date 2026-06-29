import type { ComponentType } from 'react'

export type AoiTool = {
  id: string
  name: string
  productLine: string
  description: string
  route: string
  Component: ComponentType
}
