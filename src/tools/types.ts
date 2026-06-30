import type { ComponentType } from 'react'

export type AoiFamilyId = 'SAFIR' | 'EDR'

export type AoiFamily = {
  id: AoiFamilyId
  name: string
  tagline: string
  description: string
}

export type AoiTool = {
  /** Internal identifier, unique within its family. */
  id: string
  /** Top-level URL slug, e.g. 'safir' -> /safir. Unique across all tools. */
  path: string
  name: string
  family: AoiFamilyId
  description: string
  Component: ComponentType
}

export type AoiRoute =
  | { type: 'home' }
  | { type: 'tool'; tool: AoiTool }
