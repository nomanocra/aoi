import { ArrowRight, LayoutGrid } from 'lucide-react'
import { aoiFamilies, toolPath, toolsForFamily } from '../tools'
import type { AoiFamily, AoiTool } from '../tools/types'
import { linkProps } from '../navigation'
import './AoiLanding.css'

function ToolCard({ tool }: { tool: AoiTool }) {
  return (
    <a className="aoi-landing__card" {...linkProps(toolPath(tool))}>
      <div className="aoi-landing__card-head">
        <span className="aoi-landing__card-family">{tool.family}</span>
        <h3>{tool.name}</h3>
      </div>
      <p>{tool.description}</p>
      <span className="aoi-landing__card-cta">
        Open tool <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
      </span>
    </a>
  )
}

function FamilySection({ family }: { family: AoiFamily }) {
  const tools = toolsForFamily(family.id)

  return (
    <section className="aoi-landing__family" aria-labelledby={`family-${family.id}`}>
      <header className="aoi-landing__family-head">
        <div>
          <h2 id={`family-${family.id}`} className="aoi-landing__family-name">
            {family.name}
          </h2>
          <p className="aoi-landing__family-tagline">{family.tagline}</p>
        </div>
        <p className="aoi-landing__family-desc">{family.description}</p>
      </header>
      {tools.length > 0 ? (
        <div className="aoi-landing__grid">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      ) : (
        <p className="aoi-landing__empty">No tools available yet.</p>
      )}
    </section>
  )
}

export function AoiLanding() {
  return (
    <main className="aoi-landing">
      <header className="aoi-landing__hero">
        <div className="aoi-landing__brand">
          <img className="aoi-landing__logo" src="/assets/aoi-logo.svg" alt="" aria-hidden="true" />
          <div>
            <strong>AOI</strong>
            <span>Airline Operations Intelligence</span>
          </div>
        </div>
        <span className="aoi-landing__hero-badge">
          <LayoutGrid size={15} strokeWidth={2.2} aria-hidden="true" />
          Tool suite
        </span>
      </header>

      <div className="aoi-landing__body">
        <div className="aoi-landing__intro">
          <h1>AOI tools</h1>
          <p>Select a tool to get started. Tools are grouped by product family.</p>
        </div>

        {aoiFamilies.map((item) => (
          <FamilySection key={item.id} family={item} />
        ))}
      </div>
    </main>
  )
}

export default AoiLanding
