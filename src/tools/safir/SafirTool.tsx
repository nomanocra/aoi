import { useEffect, useMemo, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  Info,
  Network,
  Settings,
  Ship,
} from 'lucide-react'
import { AoiAppHeader } from '../../components/AoiAppHeader'
import './SafirTool.css'

const mapboxToken = (
  import.meta as ImportMeta & { env: Record<string, string | undefined> }
).env.VITE_MAPBOX_TOKEN

const kpis = [
  {
    label: 'Total SAF Consumed',
    value: '626.01',
    unit: 'kt',
    trend: '+160.86%',
    helper: 'Compared to 2023',
  },
  {
    label: 'Total CO2 Emissions',
    value: '806.53',
    unit: 'MtCO2',
    trend: '+32.67%',
    helper: 'Compared to 2023',
  },
  {
    label: 'CO2 Emissions avoided by SAF',
    value: '1.01',
    unit: 'MtCO2',
    trend: '+140.23%',
    helper: 'Compared to 2023',
  },
  {
    label: 'Avg. SAF-Jet blend',
    value: '0.25',
    unit: '%',
    trend: '+177.78%',
    helper: 'Compared to 2023',
    extra: 'HEllo',
  },
]

const countryBars = [
  ['FR', 48],
  ['US', 42],
  ['AT', 37.8],
  ['HK', 33.5],
  ['GB', 25.2],
  ['NL', 16.5],
  ['DE', 10],
  ['ES', 7.6],
  ['SG', 5.9],
  ['AE', 4.2],
] as const

const monthly = [
  ['Jan', 1.2],
  ['Feb', 1.6],
  ['Mar', 2.15],
  ['Apr', 2.15],
  ['May', 1.84],
  ['Jun', 2.02],
  ['Jul', 2.45],
  ['Aug', 2.95],
  ['Sep', 2.7],
  ['Oct', 3.08],
  ['Nov', 2.82],
  ['Dec', 3.3],
] as const

const airlineRatio = [
  { airline: 'DHL AIR', jet: 46, saf: 1.4 },
  { airline: 'AIR FRANCE', jet: 35, saf: 7.1 },
  { airline: 'KLM-ROYAL\nDUTCH AR...', jet: 30.5, saf: 4.4 },
  { airline: 'WIZZ AIR', jet: 21.2, saf: 7.6 },
  { airline: 'BRUSSELS\nAIRLINES', jet: 24.2, saf: 2.2 },
  { airline: 'DEUTSCHE\nLUFTHANS...', jet: 12.1, saf: 3.8 },
  { airline: 'SWISS', jet: 14.1, saf: 1.0 },
  { airline: 'AISTRIAN\nAIRLINES A...', jet: 10.3, saf: 0 },
  { airline: 'EUROWINGS', jet: 8.6, saf: 0.5 },
  { airline: 'BRITISH\nAIRWAYS', jet: 5.2, saf: 0 },
]

const suppliers = [
  'Nest',
  'World Energy',
  'TotalEnergies',
  'OMV',
  'China National\nAviation Fuel',
  'Repsol',
  'FulcrumBio\nEnergy',
  'Montana\nRenewables',
  'Diamond Green\nDiesel',
]

const airlines = [
  'DHL AIR',
  'AIR FRANCE',
  'KLM-ROYAL\nDUTCH ARILI...',
  'WIZZ AIR',
  'BRUSSELS\nAIRLINES',
  'DEUTSCHE\nLUFTHANSA AG',
  'SWISS',
  'AISTRIAN\nAIRLINES AG D...',
  'EUROWINGS',
]

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function getChartColors() {
  return {
    panel: cssVar('--safir-panel', '#252a31'),
    text: cssVar('--safir-text', '#f6f7f9'),
    muted: cssVar('--safir-text-muted', '#d3d8de'),
    subtle: cssVar('--safir-text-subtle', '#8f99a8'),
    grid: cssVar('--safir-grid', '#383e47'),
    primary: cssVar('--safir-primary', '#3affe5'),
    primaryStrong: cssVar('--safir-primary-strong', '#00e2be'),
    gray: cssVar('--safir-series-muted', '#738091'),
  }
}

function baseGrid(left = 58, right = 10, top = 24, bottom = 38) {
  return { left, right, top, bottom, containLabel: false }
}

function useChartOptions() {
  return useMemo(() => {
    const c = getChartColors()
    const textStyle = { fontFamily: 'Source Sans Pro', color: c.muted }

    const barOption: EChartsOption = {
      backgroundColor: c.panel,
      animation: false,
      grid: baseGrid(58, 10, 30, 40),
      textStyle,
      xAxis: {
        type: 'category',
        name: 'Country',
        nameLocation: 'middle',
        nameGap: 28,
        data: countryBars.map(([country]) => country),
        axisLabel: { color: c.subtle, fontSize: 11 },
        axisLine: { lineStyle: { color: c.muted } },
        axisTick: { show: false },
        nameTextStyle: { color: c.text, fontSize: 12, fontWeight: 600 },
      },
      yAxis: {
        type: 'value',
        name: 'Total SAF Burned (tonnes)',
        nameLocation: 'middle',
        nameGap: 42,
        min: 0,
        max: 50,
        interval: 10,
        axisLabel: { color: c.subtle, fontSize: 11, formatter: (v: number) => (v ? `${v}k` : '0') },
        splitLine: { lineStyle: { color: c.grid, width: 1 } },
        axisLine: { show: false },
        axisTick: { show: false },
        nameTextStyle: { color: c.text, fontSize: 12, fontWeight: 600 },
      },
      series: [
        {
          type: 'bar',
          data: countryBars.map(([, value]) => value),
          barWidth: '62%',
          barMaxWidth: 51,
          itemStyle: { color: c.primary },
        },
      ],
    }

    const lineOption: EChartsOption = {
      backgroundColor: c.panel,
      animation: false,
      grid: baseGrid(58, 10, 30, 40),
      textStyle,
      xAxis: {
        type: 'category',
        data: monthly.map(([month]) => month),
        axisLabel: { color: c.subtle, fontSize: 11 },
        axisLine: { lineStyle: { color: c.muted } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Total SAF Burned (tonnes)',
        nameLocation: 'middle',
        nameGap: 42,
        min: 0,
        max: 5,
        interval: 1,
        axisLabel: { color: c.subtle, fontSize: 11, formatter: (v: number) => (v ? `${v}k` : '0') },
        splitLine: { lineStyle: { color: c.grid, width: 1 } },
        axisLine: { show: false },
        axisTick: { show: false },
        nameTextStyle: { color: c.text, fontSize: 12, fontWeight: 600 },
      },
      series: [
        {
          type: 'line',
          data: monthly.map(([, value]) => value),
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { color: c.primaryStrong, width: 2 },
          itemStyle: { color: c.panel, borderColor: c.primaryStrong, borderWidth: 2 },
        },
      ],
    }

    const stackedOption: EChartsOption = {
      backgroundColor: c.panel,
      animation: false,
      grid: baseGrid(62, 86, 28, 42),
      legend: { show: false },
      textStyle,
      xAxis: {
        type: 'category',
        data: airlineRatio.map((item) => item.airline),
        axisLabel: { color: c.muted, fontSize: 10, interval: 0 },
        axisLine: { lineStyle: { color: c.muted } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Total Fuel Burned (tonnes)',
        nameLocation: 'middle',
        nameGap: 44,
        min: 0,
        max: 50,
        interval: 10,
        axisLabel: { color: c.muted, fontSize: 10, formatter: (v: number) => (v ? `${v}k` : '0') },
        splitLine: { lineStyle: { color: cssVar('--safir-panel-alt', '#2f343c') } },
        axisLine: { show: false },
        axisTick: { show: false },
        nameTextStyle: { color: c.text, fontSize: 12, fontWeight: 700 },
      },
      series: [
        {
          name: 'SAF',
          type: 'bar',
          stack: 'fuel',
          data: airlineRatio.map((item) => item.saf),
          itemStyle: { color: c.primary },
          barWidth: '62%',
          barMaxWidth: 51,
        },
        {
          name: 'Jet A-1',
          type: 'bar',
          stack: 'fuel',
          data: airlineRatio.map((item) => item.jet),
          itemStyle: { color: c.gray },
          barWidth: '62%',
          barMaxWidth: 51,
        },
      ],
    }

    return { barOption, lineOption, stackedOption }
  }, [])
}

function SafirHeaderActions() {
  return (
    <>
      <span>Flight Data Last Update: Oct 2024</span>
      <button type="button" aria-label="Information">
        <Info size={18} />
      </button>
      <button type="button" aria-label="Settings">
        <Settings size={18} />
      </button>
    </>
  )
}

function Header() {
  return (
    <AoiAppHeader
      actions={<SafirHeaderActions />}
      appName="SAFIR"
      subtitle="By Airline Operations Intelligence"
    />
  )
}

function AppMenu() {
  const items = [
    { icon: Network, active: true, label: 'Network structure' },
    { icon: Ship, label: 'Network operations' },
    { icon: BarChart3, label: 'Performance' },
    { icon: BriefcaseBusiness, label: 'Portfolio' },
    { icon: CircleDollarSign, label: 'Finance' },
  ]

  return (
    <nav className="safir-menu" aria-label="SAFIR navigation">
      {items.map(({ icon: Icon, active, label }) => (
        <button className={active ? 'is-active' : ''} key={label} type="button" aria-label={label}>
          <Icon size={18} />
        </button>
      ))}
    </nav>
  )
}

function SegmentedYears() {
  return (
    <div className="year-tabs" aria-label="Year">
      <button type="button">2022</button>
      <button type="button">2023</button>
      <button className="is-selected" type="button">
        2024
      </button>
    </div>
  )
}

function Filters() {
  const chips = ['Region', 'Country', 'Airport', 'Manufacturer']
  return (
    <section className="filters-row">
      <div className="filter-block year-block">
        <span className="field-label">YEAR</span>
        <SegmentedYears />
      </div>
      <div className="filter-block">
        <span className="field-label">FILTERS</span>
        <div className="chip-row">
          {chips.slice(0, 3).map((chip) => (
            <button className="filter-chip" key={chip} type="button">
              {chip}
            </button>
          ))}
          <button className="filter-chip filter-chip--active" type="button">
            Airline <strong>AFR - Air France, +4</strong>
            <span aria-hidden="true">×</span>
          </button>
          <button className="filter-chip" type="button">
            {chips[3]}
          </button>
        </div>
      </div>
    </section>
  )
}

function KpiTile({ label, value, unit, trend, helper, extra }: (typeof kpis)[number]) {
  return (
    <article className="kpi-tile">
      <h2>{label}</h2>
      <div className="kpi-content">
        <div className="kpi-value">
          <strong>{value}</strong>
          <span>{unit}</span>
        </div>
        <div className="kpi-trend">
          <strong>{trend}</strong>
          <span>{helper}</span>
        </div>
        {extra && <span className="kpi-extra">{extra}</span>}
      </div>
    </article>
  )
}

function SelectPill({ label }: { label: string }) {
  return (
    <button className="select-pill" type="button">
      {label}
      <span aria-hidden="true" />
    </button>
  )
}

function ChartTile({
  title,
  filters,
  children,
  className = '',
}: {
  title: string
  filters?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <article className={`chart-tile ${className}`}>
      <header className="chart-title">
        <h2>{title}</h2>
      </header>
      {filters && <div className="chart-filters">{filters}</div>}
      <div className="chart-body">{children}</div>
    </article>
  )
}

function SafMap() {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapRef.current || !mapboxToken) return undefined

    mapboxgl.accessToken = mapboxToken
    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [2.6, 49.1],
      zoom: 3.85,
      interactive: false,
      attributionControl: false,
    })

    const markers = [
      { lngLat: [2.35, 48.85] as [number, number], value: '18t', size: 40 },
      { lngLat: [-0.45, 51.47] as [number, number], value: '5.1t', size: 30 },
    ]

    markers.forEach((marker) => {
      const el = document.createElement('div')
      el.className = 'map-marker'
      el.style.width = `${marker.size}px`
      el.style.height = `${marker.size}px`
      el.textContent = marker.value
      new mapboxgl.Marker({ element: el }).setLngLat(marker.lngLat).addTo(map)
    })

    return () => map.remove()
  }, [])

  return (
    <div className="map-shell">
      {mapboxToken ? <div className="mapbox-container" ref={mapRef} /> : <FallbackMap />}
    </div>
  )
}

function FallbackMap() {
  return (
    <div className="fallback-map">
      <img src="/assets/safir-basemap.png" alt="" />
      <span className="map-bubble map-bubble--london">5.1t</span>
      <span className="map-bubble map-bubble--paris">18t</span>
    </div>
  )
}

function SankeyLabels({ side }: { side: 'left' | 'right' }) {
  const labels = side === 'left' ? suppliers : airlines
  return (
    <div className={`sankey-labels sankey-labels--${side}`}>
      {labels.map((label) => (
        <span className={label.startsWith('OMV') || label.startsWith('DHL') ? 'is-highlighted' : ''} key={label}>
          {label.split('\n').map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      ))}
    </div>
  )
}


function SankeyFlow() {
  return (
    <div className="sankey-flow" aria-hidden="true">
      <img src="/assets/safir-dependencies.svg" alt="" />
    </div>
  )
}

function Legend() {
  return (
    <div className="ratio-legend">
      <span>
        <i className="legend-box legend-box--jet" /> Jet A-1
      </span>
      <span>
        <i className="legend-box legend-box--saf" /> SAF
      </span>
    </div>
  )
}

function SafirTool() {
  const { barOption, lineOption, stackedOption } = useChartOptions()

  return (
    <main className="safir-app">
      <Header />
      <div className="safir-main">
        <AppMenu />
        <section className="safir-page" aria-labelledby="page-title">
          <h1 id="page-title">SAF Consumption</h1>
          <Filters />

          <section className="kpi-grid" aria-label="SAF indicators">
            {kpis.map((kpi) => (
              <KpiTile key={kpi.label} {...kpi} />
            ))}
          </section>

          <section className="top-charts">
            <ChartTile
              title="SAF Consumption"
              filters={
                <>
                  <span className="field-label">DATA</span>
                  <SelectPill label="Country" />
                  <span className="field-label">SLIT BY</span>
                  <SelectPill label="None" />
                  <span className="field-label">TOP</span>
                  <SelectPill label="10" />
                </>
              }
            >
              <ReactECharts option={barOption} className="echart" />
            </ChartTile>

            <ChartTile
              title="SAF Consumption per month"
              filters={
                <>
                  <span className="field-label">COUNTRY</span>
                  <SelectPill label="All" />
                </>
              }
            >
              <ReactECharts option={lineOption} className="echart" />
            </ChartTile>
          </section>

          <section className="lower-grid">
            <ChartTile title="SAF Distribution - Airlines Suppliers" className="sankey-tile">
              <div className="sankey-content">
                <SankeyLabels side="left" />
                <SankeyFlow />
                <SankeyLabels side="right" />
              </div>
            </ChartTile>

            <ChartTile
              title="Airport SAF providers"
              className="map-tile"
              filters={
                <div className="map-filter">
                  <SelectPill label="Air France" />
                </div>
              }
            >
              <SafMap />
            </ChartTile>

            <ChartTile
              title="Airline SAF Ratio Consumption"
              className="ratio-tile"
              filters={
                <>
                  <span className="field-label">SORT BY</span>
                  <SelectPill label="Total Fuel Burned" />
                  <span className="field-label">TOP</span>
                  <SelectPill label="10" />
                </>
              }
            >
              <div className="ratio-chart-wrap">
                <ReactECharts option={stackedOption} className="echart" />
                <Legend />
              </div>
            </ChartTile>
          </section>
        </section>
      </div>
    </main>
  )
}

export default SafirTool
