import { useState } from 'react'
import {
  Plane,
  PlaneTakeoff,
  Calendar,
  Building2,
  Share2,
  Info,
  Monitor,
  Mail,
  FileText,
  ExternalLink,
  Route as RouteIcon,
  Cpu,
  CloudLightning,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react'
import { aoiTools, toolPath } from '../tools'
import { linkProps } from '../navigation'
import './AoiLanding.css'

type ShowcaseApp = {
  icon: LucideIcon
  title: string
  description: string
}

/** Object-oriented showcase apps (visual catalog — not yet wired to real tools). */
const OBJECT_ORIENTED_APPS: ShowcaseApp[] = [
  { icon: Building2, title: 'Airport App', description: 'Get all insights and information on one airport' },
  { icon: LayoutGrid, title: 'Runway App', description: 'Get all insights and all information on one runway' },
  { icon: Plane, title: 'Aircraft App', description: 'Get all insights and information on one aircraft' },
  { icon: RouteIcon, title: 'Route App', description: 'Get all insights and information on one route' },
  { icon: PlaneTakeoff, title: 'Airline App', description: 'Get all insights and information on one airline' },
  { icon: Cpu, title: 'Aircraft Program App', description: 'Get all insights and information on one aircraft program' },
  { icon: CloudLightning, title: 'Weather App', description: 'Get all insights and information on weather' },
]

type TabId = 'applications' | 'datasets' | 'studies'

const TABS: { id: TabId; label: string }[] = [
  { id: 'applications', label: 'Applications' },
  { id: 'datasets', label: 'Datasets' },
  { id: 'studies', label: 'Studies' },
]

function InfoTip({ text }: { text: string }) {
  return (
    <span className="aoi-home__info">
      <Info size={16} strokeWidth={2} aria-hidden="true" />
      <span className="aoi-home__tooltip" role="tooltip">
        {text}
      </span>
    </span>
  )
}

function ShowcaseCard({ app }: { app: ShowcaseApp }) {
  const Icon = app.icon
  return (
    <div className="aoi-card aoi-card--static">
      <Icon className="aoi-card__icon" size={24} strokeWidth={1.8} aria-hidden="true" />
      <div className="aoi-card__body">
        <p className="aoi-card__title">{app.title}</p>
        <p className="aoi-card__desc">{app.description}</p>
      </div>
    </div>
  )
}

export function AoiLanding() {
  const [activeTab, setActiveTab] = useState<TabId>('applications')

  return (
    <div className="aoi-home">
      <header className="aoi-home__header">
        <a className="aoi-home__brand" {...linkProps('/')} aria-label="AOI home">
          <img className="aoi-home__logo" src="/assets/aoi-logo.svg" alt="" aria-hidden="true" />
          <span className="aoi-home__brand-text">
            <b>Airline</b>
            <b>Operations</b>
            <b>Intelligence</b>
            <em>by Airbus Sciences</em>
          </span>
        </a>

        <div className="aoi-home__titleblock">
          <h1>AOI - Home Page</h1>
          <p>Trusted insights on Airline Operations, worldwide and cross-fleet</p>
        </div>

        <div className="aoi-home__cta">
          <button type="button" className="aoi-home__btn">
            <ExternalLink size={12} strokeWidth={2.4} aria-hidden="true" />
            SIMULATION
          </button>
          <button type="button" className="aoi-home__btn">
            <Mail size={12} strokeWidth={2.4} aria-hidden="true" />
            CONTACT US
          </button>
          <button type="button" className="aoi-home__btn">
            <FileText size={12} strokeWidth={2.4} aria-hidden="true" />
            DOCUMENTATION
          </button>
        </div>
      </header>

      <div className="aoi-home__statswrap">
        <div className="aoi-home__stats">
          <div className="aoi-stat">
            <Plane size={20} strokeWidth={1.8} aria-hidden="true" />
            <b>198 348 174</b>
            <span>Flights Tracked</span>
          </div>
          <div className="aoi-stat">
            <Calendar size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>From</span>
            <b>1 jan 2024</b>
            <span>to</span>
            <b>23 sep 2024</b>
          </div>
          <div className="aoi-stat">
            <Building2 size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>Operated by</span>
            <b>2453</b>
            <span>airlines</span>
          </div>
          <div className="aoi-stat">
            <Share2 size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>Over</span>
            <b>84 994</b>
            <span>routes</span>
          </div>
          <div className="aoi-stat">
            <Plane size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>With</span>
            <b>32 994</b>
            <span>Aircraft</span>
          </div>
        </div>
      </div>

      <main className="aoi-home__main">
        <div className="aoi-home__content">
          <p className="aoi-home__intro">
            Consume our insight on Airline Operations through ready-to-use applications, datasets, or
            upon-requested studies. <a className="aoi-home__link" href="#">Learn more...</a>
          </p>

          <div className="aoi-home__tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`aoi-home__tab${activeTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'applications' ? (
            <>
              <p className="aoi-home__tabdesc">
                Use dashboards to understand the airline operations. Explore graphs and metrics, define
                filters and get into the details of airlines operations through object or business
                oriented applications.
              </p>

              <div className="aoi-home__section-head">
                <h2>Object-Oriented</h2>
                <InfoTip text="Object-oriented apps allow to get insights and information on one specific object of the Air Transport System (airport, airline, aircraft, route, runway, aircraft program, flight, ...)" />
              </div>
              <div className="aoi-home__grid">
                {OBJECT_ORIENTED_APPS.map((app) => (
                  <ShowcaseCard key={app.title} app={app} />
                ))}
              </div>

              <div className="aoi-home__section-head">
                <h2>Business-Oriented</h2>
                <InfoTip text="Business-oriented apps are designed to follow a specific business flow and group all the related insights in one single app." />
              </div>
              <div className="aoi-home__grid">
                {aoiTools.map((tool) => (
                  <a key={tool.id} className="aoi-card aoi-card--link" {...linkProps(toolPath(tool))}>
                    <Monitor className="aoi-card__icon" size={24} strokeWidth={1.8} aria-hidden="true" />
                    <div className="aoi-card__body">
                      <p className="aoi-card__title">{tool.name}</p>
                      <p className="aoi-card__desc">{tool.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <p className="aoi-home__placeholder">
              {activeTab === 'datasets' ? 'Datasets' : 'Studies'} coming soon.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

export default AoiLanding
