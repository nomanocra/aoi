import type { ReactNode } from 'react'
import './AoiAppHeader.css'

type AoiAppHeaderProps = {
  appName: string
  subtitle?: string
  actions?: ReactNode
}

export function AoiAppHeader({ appName, subtitle, actions }: AoiAppHeaderProps) {
  return (
    <header className="aoi-app-header">
      <div className="aoi-app-header__brand">
        <img className="aoi-app-header__logo" src="/assets/aoi-logo.svg" alt="" aria-hidden="true" />
        <strong>{appName}</strong>
        {subtitle && <em>{subtitle}</em>}
      </div>
      {actions && <div className="aoi-app-header__actions">{actions}</div>}
    </header>
  )
}
