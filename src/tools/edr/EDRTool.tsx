import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import cytoscape, { type Core, type ElementDefinition, type NodeSingular, type StylesheetJson } from 'cytoscape'
import { ChevronDown, ChevronUp, Database, Eye, EyeOff, Search } from 'lucide-react'
import { AoiAppHeader } from '../../components/AoiAppHeader'
import './EDRTool.css'

const catalogueNames = [
  'oag_regions',
  'mapping_airport_region_sabre',
  'mapping_airport_area',
  'landmass_geojson',
  'landmass_areas',
  'country_region_mapping',
  'countries_segmented_areas',
  'countries_geojson',
  'countries_areas',
]

const graphElements: ElementDefinition[] = [
  { data: { id: 'airports', label: 'airports', type: 'domain' } },
  { data: { id: 'regions', label: 'regions', type: 'domain' } },
  { data: { id: 'network', label: 'network', type: 'domain' } },
  { data: { id: 'airport', label: 'airport', type: 'table', parent: 'airports' }, position: { x: 180, y: 210 } },
  {
    data: { id: 'mapping_airport', label: 'mapping_airport', type: 'table', parent: 'airports', primary: true },
    position: { x: 338, y: 178 },
  },
  {
    data: { id: 'runway', label: 'runway', type: 'table', parent: 'airports' },
    position: { x: 246, y: 286 },
  },
  {
    data: { id: 'airport_cycles', label: 'airport_cycles', type: 'table', parent: 'airports' },
    position: { x: 170, y: 132 },
  },
  {
    data: { id: 'mapping_airport_area', label: 'mapping_airport_area', type: 'table', parent: 'regions', primary: true },
    position: { x: 610, y: 166 },
  },
  {
    data: { id: 'countries_areas', label: 'countries_areas', type: 'table', parent: 'regions' },
    position: { x: 548, y: 252 },
  },
  {
    data: { id: 'landmass_areas', label: 'landmass_areas', type: 'table', parent: 'regions' },
    position: { x: 724, y: 238 },
  },
  {
    data: { id: 'countries_geojson', label: 'countries_geojson', type: 'table', parent: 'regions' },
    position: { x: 612, y: 322 },
  },
  {
    data: { id: 'oag_regions', label: 'oag_regions', type: 'table', parent: 'regions' },
    position: { x: 760, y: 314 },
  },
  {
    data: { id: 'flight_network', label: 'flight_network', type: 'table', parent: 'network' },
    position: { x: 404, y: 314 },
  },
  {
    data: { id: 'carrier', label: 'carrier', type: 'table', parent: 'network' },
    position: { x: 404, y: 402 },
  },
  {
    data: { id: 'aircraft', label: 'aircraft', type: 'external' },
    position: { x: 468, y: 78 },
  },
  {
    data: { id: 'weather', label: 'weather', type: 'external' },
    position: { x: 336, y: 78 },
  },
  { data: { id: 'airport-mapping_airport', source: 'airport', target: 'mapping_airport', label: 'airport_id' } },
  { data: { id: 'runway-airport', source: 'runway', target: 'airport', label: 'airport_id' } },
  { data: { id: 'airport_cycles-airport', source: 'airport_cycles', target: 'airport', label: 'cycle_id' } },
  { data: { id: 'mapping_airport-area', source: 'mapping_airport', target: 'mapping_airport_area', label: 'area_id' } },
  { data: { id: 'countries_areas-area', source: 'countries_areas', target: 'mapping_airport_area', label: 'country_area_id' } },
  { data: { id: 'landmass_areas-countries', source: 'landmass_areas', target: 'countries_areas', label: 'landmass_id' } },
  { data: { id: 'countries_geojson-countries', source: 'countries_geojson', target: 'countries_areas', label: 'iso2' } },
  { data: { id: 'oag_regions-countries', source: 'oag_regions', target: 'countries_areas', label: 'region_id' } },
  { data: { id: 'network-airport', source: 'flight_network', target: 'airport', label: 'origin_airport_id' } },
  { data: { id: 'network-carrier', source: 'flight_network', target: 'carrier', label: 'carrier_id' } },
  { data: { id: 'mapping-weather', source: 'mapping_airport', target: 'weather', label: 'station_id' } },
  { data: { id: 'mapping-aircraft', source: 'mapping_airport', target: 'aircraft', label: 'aircraft_type' } },
]

const COLLAPSED_FOLDER_FALLBACK_WIDTH = 352
const COLLAPSED_FOLDER_BODY_HEIGHT = 29
const FOLDER_HEADER_HEIGHT = 24
const FOLDER_HEADER_GAP = 4
const FOLDER_OVERLAY_OFFSET = 28
const CONTAINER_OVERLAP_GAP = 28

type ElementData = {
  id?: string
  source?: string
  target?: string
  parent?: string
  type?: string
  label?: string
}

const nodeMetaById = new Map<string, { parent?: string; type?: string }>()
graphElements.forEach((element) => {
  const data = element.data as ElementData
  if (data?.id && !data.source) {
    nodeMetaById.set(data.id, { parent: data.parent, type: data.type })
  }
})

/** Returns the top-level container of a node: its parent domain, or itself for top-level nodes. */
function containerIdOf(nodeId: string): string {
  return nodeMetaById.get(nodeId)?.parent ?? nodeId
}

type MetaEdge = {
  sourceNode: string
  targetNode: string
  sourceContainer: string
  targetContainer: string
  label?: string
}

/**
 * Cross-container relationships derived from the table edges: any edge whose endpoints live in
 * two different containers (two domains, or a domain and an external entity). They are drawn as
 * aggregated links so relationships survive when a group is collapsed. Each keeps its underlying
 * node endpoints so an open group can anchor the link on the exact item it concerns.
 */
const metaEdges: MetaEdge[] = (() => {
  const result: MetaEdge[] = []

  graphElements.forEach((element) => {
    const data = element.data as ElementData
    if (!data?.source || !data.target) return

    const sourceContainer = containerIdOf(data.source)
    const targetContainer = containerIdOf(data.target)
    if (sourceContainer === targetContainer) return

    result.push({
      sourceNode: data.source,
      targetNode: data.target,
      sourceContainer,
      targetContainer,
      label: data.label,
    })
  })

  return result
})()

function cssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function getGraphStyles(): StylesheetJson {
  const background = cssVar('--safir-bg', '#1c2127')
  const panel = cssVar('--safir-panel', '#252a31')
  const panelAlt = cssVar('--safir-panel-alt', '#2f343c')
  const control = cssVar('--safir-control', '#383e47')
  const border = cssVar('--aoi-gray-1', '#5f6b7c')
  const borderSoft = cssVar('--safir-border-strong', 'rgba(255,255,255,.2)')
  const text = cssVar('--safir-text', '#f6f7f9')
  const muted = cssVar('--safir-text-muted', '#d3d8de')
  const subtle = cssVar('--safir-text-subtle', '#8f99a8')
  const primary = cssVar('--safir-primary-strong', '#00e2be')
  const black = cssVar('--aoi-black', '#000000')

  return [
    {
      selector: 'node',
      style: {
        'background-color': control,
        'border-color': border,
        'border-width': 1,
        color: text,
        content: 'data(label)',
        'font-family': 'Source Sans 3',
        'font-size': 16,
        height: 34,
        'overlay-opacity': 0,
        shape: 'round-rectangle',
        'text-halign': 'center',
        'text-valign': 'center',
        width: 104,
      },
    },
    {
      selector: 'node[type = "domain"]',
      style: {
        'background-color': panel,
        'background-opacity': 0.8,
        'border-color': borderSoft,
        'border-width': 1,
        'bounds-expansion': '10px',
        'compound-sizing-wrt-labels': 'include',
        color: muted,
        content: '',
        'font-size': 12,
        'font-weight': 700,
        'min-height': '210px',
        'min-height-bias-top': '35%',
        'min-width': '250px',
        'min-width-bias-left': '50%',
        padding: '54px',
        'text-halign': 'left',
        'text-margin-x': -28,
        'text-margin-y': -24,
        'text-valign': 'top',
      },
    },
    {
      selector: 'node[primary]',
      style: {
        'background-color': control,
        'border-color': primary,
        color: primary,
        'font-weight': 700,
        width: 132,
      },
    },
    {
      selector: 'node[type = "external"]',
      style: {
        'background-color': panelAlt,
        'border-color': border,
        color: muted,
        height: 34,
        width: 86,
      },
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'font-size': 8,
        color: subtle,
        content: 'data(label)',
        'line-color': border,
        'line-opacity': 0.72,
        'target-arrow-color': border,
        'target-arrow-shape': 'triangle',
        'text-background-color': background,
        'text-background-opacity': 0.86,
        'text-background-padding': '2px',
        'text-rotation': 'autorotate',
        width: 1,
      },
    },
    {
      selector: ':selected',
      style: {
        'background-color': primary,
        'border-color': primary,
        'line-color': primary,
        'target-arrow-color': primary,
      },
    },
    {
      selector: 'node:selected',
      style: {
        color: black,
      },
    },
    {
      selector: '.is-faded',
      style: {
        opacity: 0.24,
      },
    },
    {
      selector: 'node[type = "domain"].is-folder-collapsed',
      style: {
        'background-color': background,
        'background-opacity': 0,
        'border-width': 0,
        color: muted,
        content: '',
        'font-size': 11,
        'font-weight': 400,
        height: COLLAPSED_FOLDER_BODY_HEIGHT,
        'min-height': `${COLLAPSED_FOLDER_BODY_HEIGHT}px`,
        'min-height-bias-top': '50%',
        'min-width': `${COLLAPSED_FOLDER_FALLBACK_WIDTH}px`,
        'min-width-bias-left': '50%',
        padding: '0px',
        'text-halign': 'center',
        'text-margin-x': 0,
        'text-margin-y': 0,
        'text-valign': 'center',
        width: COLLAPSED_FOLDER_FALLBACK_WIDTH,
      },
    },
  ]
}

function runCollisionSafeLayout(cy: Core, animate: boolean, onStop?: () => void) {
  const layout = cy.layout({
    name: 'cose',
    animate,
    animationDuration: 260,
    avoidOverlap: true,
    componentSpacing: 140,
    edgeElasticity: () => 80,
    fit: true,
    gravity: 0.18,
    idealEdgeLength: () => 150,
    nestingFactor: 1.35,
    nodeDimensionsIncludeLabels: true,
    nodeOverlap: 64,
    nodeRepulsion: () => 9000,
    numIter: animate ? 900 : 1800,
    padding: 72,
    randomize: false,
    refresh: animate ? 12 : 30,
    spacingFactor: 1.55,
  })

  if (onStop) layout.one('layoutstop', onStop)
  layout.run()
}

function collapseAllDomainFolders(cy: Core) {
  const domainSnapshots = cy.nodes('[type = "domain"]').map((domain) => ({
    domain,
    expandedBox: domain.boundingBox({
      includeEdges: false,
      includeLabels: false,
      includeNodes: true,
      includeOverlays: false,
      includeUnderlays: false,
    }),
  }))

  cy.batch(() => {
    domainSnapshots.forEach(({ domain, expandedBox }) => {
      const descendants = domain.descendants()
      const relatedEdges = descendants.connectedEdges()

      domain.data({
        collapsedModelWidth: expandedBox.w,
        collapsedModelX: expandedBox.x1,
        collapsedModelY: expandedBox.y1,
      })
      domain.addClass('is-folder-collapsed')
      descendants.style('display', 'none')
      relatedEdges.style('display', 'none')
    })
    syncRelationshipVisibility(cy)
  })
}

function syncRelationshipVisibility(cy: Core) {
  cy.edges().forEach((edge) => {
    const shouldShow = edge.source().visible() && edge.target().visible()

    edge.style('display', shouldShow ? 'element' : 'none')
  })
}

type GraphBox = {
  x1: number
  x2: number
  y1: number
  y2: number
}

function getNodeBox(node: NodeSingular, padding = 10): GraphBox {
  const box = node.boundingBox({
    includeEdges: false,
    includeLabels: true,
    includeNodes: true,
    includeOverlays: false,
    includeUnderlays: false,
  })

  return {
    x1: box.x1 - padding,
    x2: box.x2 + padding,
    y1: box.y1 - padding,
    y2: box.y2 + padding,
  }
}

function getOverlap(a: GraphBox, b: GraphBox) {
  return {
    x: Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1),
    y: Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1),
  }
}

function getSameLevelNodes(node: NodeSingular) {
  const parent = node.parent()
  if (parent.nonempty()) return parent.children('node[type != "domain"]').not(node)

  return node.cy().nodes('[type != "domain"]').filter((candidate) => candidate.parent().empty()).not(node)
}

function resolveLocalOverlap(node: NodeSingular) {
  const maxPasses = 8
  const gap = 12

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let moved = false
    const nodeBox = getNodeBox(node, gap)

    getSameLevelNodes(node).forEach((candidate) => {
      const candidateBox = getNodeBox(candidate, gap)
      const overlap = getOverlap(nodeBox, candidateBox)

      if (overlap.x <= 0 || overlap.y <= 0) return

      const nodePosition = node.position()
      const candidatePosition = candidate.position()
      const pushX = nodePosition.x >= candidatePosition.x ? overlap.x + gap : -overlap.x - gap
      const pushY = nodePosition.y >= candidatePosition.y ? overlap.y + gap : -overlap.y - gap

      if (overlap.x < overlap.y) {
        node.position('x', nodePosition.x + pushX)
      } else {
        node.position('y', nodePosition.y + pushY)
      }

      moved = true
    })

    if (!moved) return
  }
}

/** Rendered-space box (in px, relative to the graph canvas) of a domain's folder, header included. */
function getDomainFolderRenderedBox(cy: Core, domain: NodeSingular): GraphBox {
  const zoom = cy.zoom()
  const pan = cy.pan()
  const box = domain.renderedBoundingBox({
    includeEdges: false,
    includeLabels: false,
    includeNodes: true,
    includeOverlays: false,
    includeUnderlays: false,
  })

  if (domain.hasClass('is-folder-collapsed')) {
    const collapsedModelWidth = Number(domain.data('collapsedModelWidth'))
    const collapsedModelX = Number(domain.data('collapsedModelX'))
    const collapsedModelY = Number(domain.data('collapsedModelY'))
    const width = Number.isFinite(collapsedModelWidth) ? collapsedModelWidth * zoom : COLLAPSED_FOLDER_FALLBACK_WIDTH
    const x = Number.isFinite(collapsedModelX) ? collapsedModelX * zoom + pan.x : box.x1
    const y = Number.isFinite(collapsedModelY) ? collapsedModelY * zoom + pan.y : box.y1
    const top = y - FOLDER_OVERLAY_OFFSET
    const height = FOLDER_HEADER_HEIGHT + FOLDER_HEADER_GAP + COLLAPSED_FOLDER_BODY_HEIGHT
    return { x1: x, x2: x + width, y1: top, y2: top + height }
  }

  return { x1: box.x1, x2: box.x2, y1: box.y1 - FOLDER_OVERLAY_OFFSET, y2: box.y2 }
}

function getEntityRenderedBox(node: NodeSingular): GraphBox {
  const box = node.renderedBoundingBox({
    includeEdges: false,
    includeLabels: true,
    includeNodes: true,
    includeOverlays: false,
    includeUnderlays: false,
  })

  return { x1: box.x1, x2: box.x2, y1: box.y1, y2: box.y2 }
}

function getContainerRenderedBox(cy: Core, node: NodeSingular): GraphBox {
  return node.data('type') === 'domain' ? getDomainFolderRenderedBox(cy, node) : getEntityRenderedBox(node)
}

/** Moves a whole container (a domain and its descendants, or a single external node) in model space. */
function shiftContainer(cy: Core, node: NodeSingular, modelDx: number, modelDy: number) {
  if (node.data('type') === 'domain') {
    cy.batch(() => {
      node.descendants('node').forEach((descendant) => {
        const position = descendant.position()
        descendant.position({ x: position.x + modelDx, y: position.y + modelDy })
      })

      if (node.hasClass('is-folder-collapsed')) {
        const collapsedModelX = Number(node.data('collapsedModelX'))
        const collapsedModelY = Number(node.data('collapsedModelY'))
        if (Number.isFinite(collapsedModelX) && Number.isFinite(collapsedModelY)) {
          node.data({ collapsedModelX: collapsedModelX + modelDx, collapsedModelY: collapsedModelY + modelDy })
        }
      }
    })
    return
  }

  const position = node.position()
  node.position({ x: position.x + modelDx, y: position.y + modelDy })
}

/** Iteratively pushes overlapping top-level containers (domains and external entities) apart. */
function resolveContainerOverlaps(cy: Core) {
  const zoom = cy.zoom()
  const containers = cy.nodes().filter((node: NodeSingular) => node.parent().empty() && node.visible())
  if (containers.length < 2) return

  const maxPasses = 16

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let moved = false
    const items = containers.map((node: NodeSingular) => ({ node, box: getContainerRenderedBox(cy, node) }))

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i]
        const b = items[j]
        const overlapX = Math.min(a.box.x2, b.box.x2) - Math.max(a.box.x1, b.box.x1)
        const overlapY = Math.min(a.box.y2, b.box.y2) - Math.max(a.box.y1, b.box.y1)
        if (overlapX <= 0 || overlapY <= 0) continue

        const aCenterX = (a.box.x1 + a.box.x2) / 2
        const aCenterY = (a.box.y1 + a.box.y2) / 2
        const bCenterX = (b.box.x1 + b.box.x2) / 2
        const bCenterY = (b.box.y1 + b.box.y2) / 2

        if (overlapX < overlapY) {
          const push = (overlapX + CONTAINER_OVERLAP_GAP) / 2 / zoom
          const direction = aCenterX <= bCenterX ? -1 : 1
          shiftContainer(cy, a.node, direction * push, 0)
          shiftContainer(cy, b.node, -direction * push, 0)
        } else {
          const push = (overlapY + CONTAINER_OVERLAP_GAP) / 2 / zoom
          const direction = aCenterY <= bCenterY ? -1 : 1
          shiftContainer(cy, a.node, 0, direction * push)
          shiftContainer(cy, b.node, 0, -direction * push)
        }

        a.box = getContainerRenderedBox(cy, a.node)
        b.box = getContainerRenderedBox(cy, b.node)
        moved = true
      }
    }

    if (!moved) break
  }
}

type MetaLink = {
  id: string
  label?: string
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Point where the segment from the box centre toward (towardX, towardY) crosses the box border. */
function borderPoint(box: GraphBox, towardX: number, towardY: number) {
  const centerX = (box.x1 + box.x2) / 2
  const centerY = (box.y1 + box.y2) / 2
  const dx = towardX - centerX
  const dy = towardY - centerY
  const halfWidth = (box.x2 - box.x1) / 2 || 1
  const halfHeight = (box.y2 - box.y1) / 2 || 1
  const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 1e-6)
  return { x: centerX + dx * scale, y: centerY + dy * scale }
}

type CatalogueSelectProps = {
  selectedCatalogue: string | null
  onCatalogueSelect: (catalogue: string) => void
  label?: string
}

function CatalogueSelect({ selectedCatalogue, onCatalogueSelect, label }: CatalogueSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredCatalogues = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return catalogueNames

    return catalogueNames.filter((catalogue) => catalogue.toLowerCase().includes(normalizedQuery))
  }, [query])

  const openCatalogue = () => {
    setIsOpen(true)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const closeCatalogue = () => {
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div className="edr-catalogue-control" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) closeCatalogue()
    }}>
      {label && <span className="edr-catalogue-control__label">{label}</span>}
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="edr-catalogue-control__select"
        onClick={() => (isOpen ? closeCatalogue() : openCatalogue())}
        type="button"
      >
        {selectedCatalogue && (
          <span className="edr-catalogue-control__icon" aria-hidden="true">
            <Database size={12} strokeWidth={2.5} />
          </span>
        )}
        <span className={`edr-catalogue-control__value${selectedCatalogue ? '' : ' is-placeholder'}`}>
          {selectedCatalogue ?? 'Select Catalog'}
        </span>
        <ChevronDown className="edr-catalogue-control__chevron" size={12} strokeWidth={2} aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="edr-catalogue-menu">
          <label className="edr-catalogue-menu__search">
            <Search size={13} strokeWidth={2} aria-hidden="true" />
            <input
              aria-label="Search catalogue"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              ref={inputRef}
              type="search"
              value={query}
            />
          </label>
          <div className="edr-catalogue-menu__list" role="listbox" aria-label="Catalogue options">
            {filteredCatalogues.map((catalogue) => (
              <button
                aria-selected={catalogue === selectedCatalogue}
                className={catalogue === selectedCatalogue ? 'is-selected' : ''}
                key={catalogue}
                onClick={() => {
                  onCatalogueSelect(catalogue)
                  closeCatalogue()
                }}
                role="option"
                type="button"
              >
                {catalogue}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type EDRHeaderActionsProps = {
  selectedCatalogue: string | null
  onCatalogueSelect: (catalogue: string) => void
}

function EDRHeaderActions({ selectedCatalogue, onCatalogueSelect }: EDRHeaderActionsProps) {
  return (
    <CatalogueSelect
      label="Flight Pulse Catalog"
      onCatalogueSelect={onCatalogueSelect}
      selectedCatalogue={selectedCatalogue}
    />
  )
}

function EDREmptyState({ selectedCatalogue, onCatalogueSelect }: EDRHeaderActionsProps) {
  return (
    <div className="edr-empty-state">
      <svg
        className="edr-empty-state__visual"
        aria-hidden="true"
        fill="none"
        viewBox="0 0 132 84"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect className="edr-empty-state__frame" x="0.5" y="0.5" width="131" height="83" rx="2" />
        <path className="edr-empty-state__link" d="M50 31L86 46" />
        <path className="edr-empty-state__link" d="M50 58L86 46" />
        <rect className="edr-empty-state__node" x="15.5" y="21.5" width="39" height="17" rx="2" />
        <rect className="edr-empty-state__node" x="77.5" y="37.5" width="39" height="17" rx="2" />
        <rect className="edr-empty-state__node" x="15.5" y="49.5" width="39" height="17" rx="2" />
      </svg>
      <h1>Select a catalog</h1>
      <div className="edr-empty-state__action">
        <CatalogueSelect onCatalogueSelect={onCatalogueSelect} selectedCatalogue={selectedCatalogue} />
      </div>
    </div>
  )
}

type DomainFolderOverlay = {
  collapsed: boolean
  faded: boolean
  height: number
  id: string
  itemCount: number
  label: string
  width: number
  x: number
  y: number
}

type FolderDragState = {
  domainId: string
  lastClientX: number
  lastClientY: number
  pointerId: number
}

function EDRCatalogGraph({ catalogue }: { catalogue: string }) {
  const graphRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const folderDragRef = useRef<FolderDragState | null>(null)
  const [folderOverlays, setFolderOverlays] = useState<DomainFolderOverlay[]>([])
  const [metaLinks, setMetaLinks] = useState<MetaLink[]>([])
  const [hiddenDomains, setHiddenDomains] = useState<{ id: string; label: string }[]>([])

  const syncFolderOverlays = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return

    const overlays = cy.nodes('[type = "domain"]:visible').map((domain) => {
      const isCollapsed = domain.hasClass('is-folder-collapsed')
      const zoom = cy.zoom()
      const pan = cy.pan()
      const box = domain.renderedBoundingBox({
        includeEdges: false,
        includeLabels: false,
        includeNodes: true,
        includeOverlays: false,
        includeUnderlays: false,
      })
      const collapsedModelWidth = Number(domain.data('collapsedModelWidth'))
      const collapsedModelX = Number(domain.data('collapsedModelX'))
      const collapsedModelY = Number(domain.data('collapsedModelY'))
      const collapsedWidth = Number.isFinite(collapsedModelWidth)
        ? collapsedModelWidth * zoom
        : COLLAPSED_FOLDER_FALLBACK_WIDTH
      const collapsedX = Number.isFinite(collapsedModelX) ? collapsedModelX * zoom + pan.x : box.x1
      const collapsedY = Number.isFinite(collapsedModelY) ? collapsedModelY * zoom + pan.y : box.y1

      return {
        collapsed: isCollapsed,
        faded: domain.hasClass('is-faded'),
        height: isCollapsed ? COLLAPSED_FOLDER_BODY_HEIGHT : box.h,
        id: domain.id(),
        itemCount: domain.descendants('node[type != "domain"]').length,
        label: String(domain.data('label')),
        width: isCollapsed ? collapsedWidth : box.w,
        x: isCollapsed ? collapsedX : box.x1,
        y: isCollapsed ? collapsedY : box.y1,
      }
    })

    setFolderOverlays(overlays)

    // Cross-container links: keep relationships visible when a container is collapsed. A collapsed
    // group anchors on its rectangle; an open group anchors on the exact item the edge concerns.
    const folderBoxIndex: Record<string, { box: GraphBox; collapsed: boolean }> = {}
    overlays.forEach((folder) => {
      // The rectangle body only (the panel / "N Items" bar), excluding the header above it.
      const height = folder.collapsed ? COLLAPSED_FOLDER_BODY_HEIGHT : folder.height
      folderBoxIndex[folder.id] = {
        collapsed: folder.collapsed,
        box: { x1: folder.x, x2: folder.x + folder.width, y1: folder.y, y2: folder.y + height },
      }
    })

    const nodeBoxIndex: Record<string, GraphBox> = {}
    cy.nodes('[type != "domain"]:visible').forEach((node) => {
      nodeBoxIndex[node.id()] = getEntityRenderedBox(node)
    })

    const resolveAnchor = (nodeId: string, containerId: string) => {
      const folder = folderBoxIndex[containerId]
      // Open group -> anchor on the concerned item; collapsed group -> anchor on its rectangle.
      if (folder && !folder.collapsed && nodeBoxIndex[nodeId]) return { box: nodeBoxIndex[nodeId], key: nodeId }
      if (folder) return { box: folder.box, key: containerId }
      if (nodeBoxIndex[nodeId]) return { box: nodeBoxIndex[nodeId], key: nodeId }
      return null
    }

    const grouped = new Map<string, { source: GraphBox; target: GraphBox; labels: string[] }>()
    metaEdges.forEach((edge) => {
      const sourceCollapsed = folderBoxIndex[edge.sourceContainer]?.collapsed ?? false
      const targetCollapsed = folderBoxIndex[edge.targetContainer]?.collapsed ?? false
      // Only show when at least one side is collapsed; otherwise real table edges carry it.
      if (!sourceCollapsed && !targetCollapsed) return

      const source = resolveAnchor(edge.sourceNode, edge.sourceContainer)
      const target = resolveAnchor(edge.targetNode, edge.targetContainer)
      if (!source || !target) return

      // Collapse duplicate lines that resolve to the same pair of anchors (e.g. both collapsed).
      const key = `${source.key}::${target.key}`
      const existing = grouped.get(key)
      if (existing) {
        if (edge.label) existing.labels.push(edge.label)
        return
      }
      grouped.set(key, { source: source.box, target: target.box, labels: edge.label ? [edge.label] : [] })
    })

    const links: MetaLink[] = []
    grouped.forEach((value, key) => {
      const sourceCenter = { x: (value.source.x1 + value.source.x2) / 2, y: (value.source.y1 + value.source.y2) / 2 }
      const targetCenter = { x: (value.target.x1 + value.target.x2) / 2, y: (value.target.y1 + value.target.y2) / 2 }
      const start = borderPoint(value.source, targetCenter.x, targetCenter.y)
      const end = borderPoint(value.target, sourceCenter.x, sourceCenter.y)
      links.push({
        id: key,
        label: value.labels.length === 1 ? value.labels[0] : undefined,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
      })
    })

    setMetaLinks(links)
  }, [])

  const toggleFolder = useCallback((domainId: string) => {
    const cy = cyRef.current
    const domain = cy?.getElementById(domainId)
    if (!cy || !domain?.nonempty()) return

    const descendants = domain.descendants()
    const relatedEdges = descendants.connectedEdges()
    const isCollapsed = domain.hasClass('is-folder-collapsed')

    if (isCollapsed) {
      domain.removeClass('is-folder-collapsed')
      domain.removeData('collapsedModelWidth collapsedModelX collapsedModelY')
      descendants.style('display', 'element')
      relatedEdges.style('display', 'element')
    } else {
      const expandedBox = domain.boundingBox({
        includeEdges: false,
        includeLabels: false,
        includeNodes: true,
        includeOverlays: false,
        includeUnderlays: false,
      })

      domain.data({
        collapsedModelWidth: expandedBox.w,
        collapsedModelX: expandedBox.x1,
        collapsedModelY: expandedBox.y1,
      })
      domain.addClass('is-folder-collapsed')
      descendants.style('display', 'none')
      relatedEdges.style('display', 'none')
    }

    syncRelationshipVisibility(cy)
    resolveContainerOverlaps(cy)
    syncFolderOverlays()
  }, [syncFolderOverlays])

  const hideFolder = useCallback((domainId: string) => {
    const cy = cyRef.current
    const domain = cy?.getElementById(domainId)
    if (!cy || !domain?.nonempty()) return

    const descendants = domain.descendants()
    const relatedEdges = descendants.connectedEdges()

    relatedEdges.style('display', 'none')
    descendants.style('display', 'none')
    domain.style('display', 'none')
    setHiddenDomains((prev) =>
      prev.some((item) => item.id === domainId)
        ? prev
        : [...prev, { id: domainId, label: String(domain.data('label')) }],
    )
    syncRelationshipVisibility(cy)
    syncFolderOverlays()
  }, [syncFolderOverlays])

  const showFolder = useCallback((domainId: string) => {
    const cy = cyRef.current
    const domain = cy?.getElementById(domainId)
    if (!cy || !domain?.nonempty()) return

    domain.style('display', 'element')
    const isCollapsed = domain.hasClass('is-folder-collapsed')
    const descendants = domain.descendants()
    // Restore the group in its collapsed state by default; only reveal the
    // inner nodes/edges if the group was expanded when it was hidden.
    descendants.style('display', isCollapsed ? 'none' : 'element')
    if (!isCollapsed) descendants.connectedEdges().style('display', 'element')

    setHiddenDomains((prev) => prev.filter((item) => item.id !== domainId))
    syncRelationshipVisibility(cy)
    resolveContainerOverlaps(cy)
    syncFolderOverlays()
  }, [syncFolderOverlays])

  const showAllHidden = useCallback(() => {
    hiddenDomains.forEach((item) => showFolder(item.id))
  }, [hiddenDomains, showFolder])

  const moveFolderBy = useCallback((domainId: string, renderedDx: number, renderedDy: number) => {
    const cy = cyRef.current
    const domain = cy?.getElementById(domainId)
    if (!cy || !domain?.nonempty()) return

    const zoom = cy.zoom()
    const dx = renderedDx / zoom
    const dy = renderedDy / zoom

    cy.batch(() => {
      domain.descendants('node').forEach((node) => {
        const position = node.position()
        node.position({
          x: position.x + dx,
          y: position.y + dy,
        })
      })

      if (domain.hasClass('is-folder-collapsed')) {
        const collapsedModelX = Number(domain.data('collapsedModelX'))
        const collapsedModelY = Number(domain.data('collapsedModelY'))

        if (Number.isFinite(collapsedModelX) && Number.isFinite(collapsedModelY)) {
          domain.data({
            collapsedModelX: collapsedModelX + dx,
            collapsedModelY: collapsedModelY + dy,
          })
        }
      }
    })

    syncFolderOverlays()
  }, [syncFolderOverlays])

  const handleFolderPointerDown = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    domainId: string,
  ) => {
    if ((event.target as HTMLElement).closest('button')) return

    event.currentTarget.setPointerCapture(event.pointerId)
    folderDragRef.current = {
      domainId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      pointerId: event.pointerId,
    }
  }, [])

  const handleFolderPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = folderDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.lastClientX
    const dy = event.clientY - drag.lastClientY

    if (dx !== 0 || dy !== 0) {
      moveFolderBy(drag.domainId, dx, dy)
      folderDragRef.current = {
        ...drag,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
      }
    }
  }, [moveFolderBy])

  const handleFolderPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = folderDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    folderDragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    const cy = cyRef.current
    if (cy) resolveContainerOverlaps(cy)
    syncFolderOverlays()
  }, [syncFolderOverlays])

  useEffect(() => {
    if (!graphRef.current) return undefined

    const cy = cytoscape({
      container: graphRef.current,
      elements: graphElements,
      layout: { name: 'preset', fit: true, padding: 72 },
      maxZoom: 2.2,
      minZoom: 0.45,
      style: getGraphStyles(),
      wheelSensitivity: 0.25,
    })
    cyRef.current = cy

    // Domains (groups) can be tapped to collapse but must not be selectable.
    cy.nodes('[type = "domain"]').unselectify()

    runCollisionSafeLayout(cy, false, () => {
      collapseAllDomainFolders(cy)
      resolveContainerOverlaps(cy)
      // Re-fit on the COLLAPSED (compact) layout so labels render at a readable
      // scale by default, instead of staying zoomed out for the expanded layout.
      // Generous padding leaves room for the React folder overlays (headers / "N
      // Items" boxes) that extend beyond the Cytoscape node bounds.
      cy.fit(undefined, 110)
      syncFolderOverlays()
    })
    cy.ready(syncFolderOverlays)
    cy.on('render pan zoom resize position style add remove data', syncFolderOverlays)

    cy.on('tap', 'node[type != "domain"]', (event) => {
      const node = event.target
      cy.elements().addClass('is-faded')
      node.removeClass('is-faded')
      node.connectedEdges().removeClass('is-faded')
      node.connectedEdges().connectedNodes().removeClass('is-faded')
      node.ancestors().removeClass('is-faded')
    })

    cy.on('tap', (event) => {
      if (event.target === cy) cy.elements().removeClass('is-faded')
    })

    cy.on('dragfree', 'node[type != "domain"]', (event) => {
      resolveLocalOverlap(event.target)
      resolveContainerOverlaps(cy)
      syncFolderOverlays()
    })

    return () => {
      cyRef.current = null
      cy.destroy()
    }
  }, [catalogue, syncFolderOverlays])

  return (
    <div className="edr-catalog-graph" aria-label={`${catalogue} catalog graph`}>
      <div className="edr-catalog-graph__canvas" ref={graphRef} />
      {hiddenDomains.length > 0 && (
        <div className="edr-hidden-tray" aria-label="Hidden groups">
          <div className="edr-hidden-tray__head">
            <span>
              <EyeOff size={13} strokeWidth={2} aria-hidden="true" /> Hidden ({hiddenDomains.length})
            </span>
            <button onClick={showAllHidden} type="button">
              Show all
            </button>
          </div>
          <div className="edr-hidden-tray__list">
            {hiddenDomains.map((item) => (
              <button
                className="edr-hidden-tray__item"
                key={item.id}
                onClick={() => showFolder(item.id)}
                title={`Show ${item.label}`}
                type="button"
              >
                <Eye size={13} strokeWidth={2} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="edr-folder-layer" aria-hidden="false">
        {metaLinks.length > 0 && (
          <svg className="edr-meta-links" aria-hidden="true">
            <defs>
              <marker
                id="edr-meta-arrow"
                markerWidth="9"
                markerHeight="9"
                refX="7.5"
                refY="4.5"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0 0 L9 4.5 L0 9 z" />
              </marker>
            </defs>
            {metaLinks.map((link) => (
              <g key={link.id}>
                <line
                  x1={link.x1}
                  y1={link.y1}
                  x2={link.x2}
                  y2={link.y2}
                  markerEnd="url(#edr-meta-arrow)"
                />
                {link.label && (
                  <text x={(link.x1 + link.x2) / 2} y={(link.y1 + link.y2) / 2}>
                    {link.label}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
        {folderOverlays.map((folder) => (
          <div
            className={`edr-folder${folder.collapsed ? ' is-collapsed' : ''}${folder.faded ? ' is-faded' : ''}`}
            key={folder.id}
            style={{
              height: `${folder.collapsed ? FOLDER_HEADER_HEIGHT + FOLDER_HEADER_GAP + COLLAPSED_FOLDER_BODY_HEIGHT : folder.height + FOLDER_OVERLAY_OFFSET}px`,
              transform: `translate(${folder.x}px, ${folder.y - FOLDER_OVERLAY_OFFSET}px)`,
              width: `${folder.width}px`,
            }}
          >
            <div
              className="edr-folder__header"
              onPointerDown={(event) => handleFolderPointerDown(event, folder.id)}
              onPointerMove={handleFolderPointerMove}
              onPointerUp={handleFolderPointerUp}
            >
              <span>{folder.label}</span>
              <div className="edr-folder__actions">
                <button
                  aria-label={`Hide ${folder.label}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    hideFolder(folder.id)
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  <EyeOff size={14} />
                </button>
                <button
                  aria-label={folder.collapsed ? `Expand ${folder.label}` : `Reduce ${folder.label}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleFolder(folder.id)
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  {folder.collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </div>
            </div>
            <div
              className="edr-folder__body"
              onPointerDown={(event) => handleFolderPointerDown(event, folder.id)}
              onPointerMove={handleFolderPointerMove}
              onPointerUp={handleFolderPointerUp}
            >
              {folder.collapsed && <span>{folder.itemCount} Items</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EDRTool() {
  const [selectedCatalogue, setSelectedCatalogue] = useState<string | null>(null)

  return (
    <main className="edr-app">
      <AoiAppHeader
        actions={
          <EDRHeaderActions
            onCatalogueSelect={setSelectedCatalogue}
            selectedCatalogue={selectedCatalogue}
          />
        }
        appName="EDR App"
        subtitle="By Airline Operations Intelligence"
      />
      <section className="edr-app__workspace" aria-label="EDR App workspace">
        {selectedCatalogue ? (
          <EDRCatalogGraph catalogue={selectedCatalogue} />
        ) : (
          <EDREmptyState onCatalogueSelect={setSelectedCatalogue} selectedCatalogue={selectedCatalogue} />
        )}
      </section>
    </main>
  )
}

export default EDRTool
