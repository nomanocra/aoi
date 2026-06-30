import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import cytoscape, { type Core, type EdgeSingular, type ElementDefinition, type NodeSingular, type StylesheetJson } from 'cytoscape'
import { ChevronDown, ChevronUp, Database, Eye, EyeOff, Search, X } from 'lucide-react'
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

// The catalog is a recursive tree of groups: a "domain" node may be parented to
// another domain, nesting arbitrarily deep. Tables (and the deeper groups they
// belong to) live inside these groups. The hierarchy below goes up to three
// levels deep, e.g. airports > facilities > terminals.
const graphElements: ElementDefinition[] = [
  // ── Groups (nested via `parent`) ─────────────────────────────────────────
  { data: { id: 'airports', label: 'airports', type: 'domain' } },
  { data: { id: 'facilities', label: 'facilities', type: 'domain', parent: 'airports' } },
  { data: { id: 'terminals', label: 'terminals', type: 'domain', parent: 'facilities' } },
  { data: { id: 'regions', label: 'regions', type: 'domain' } },
  { data: { id: 'geography', label: 'geography', type: 'domain', parent: 'regions' } },
  { data: { id: 'network', label: 'network', type: 'domain' } },
  { data: { id: 'fleet', label: 'fleet', type: 'domain', parent: 'network' } },

  // ── airports ─────────────────────────────────────────────────────────────
  { data: { id: 'airport', label: 'airport', type: 'table', parent: 'airports' }, position: { x: 180, y: 150 } },
  {
    data: { id: 'mapping_airport', label: 'mapping_airport', type: 'table', parent: 'airports', primary: true },
    position: { x: 330, y: 130 },
  },
  // airports › facilities
  { data: { id: 'runway', label: 'runway', type: 'table', parent: 'facilities' }, position: { x: 170, y: 330 } },
  {
    data: { id: 'airport_cycles', label: 'airport_cycles', type: 'table', parent: 'facilities' },
    position: { x: 320, y: 330 },
  },
  // airports › facilities › terminals
  { data: { id: 'terminal', label: 'terminal', type: 'table', parent: 'terminals' }, position: { x: 200, y: 480 } },
  { data: { id: 'gate', label: 'gate', type: 'table', parent: 'terminals' }, position: { x: 330, y: 480 } },

  // ── regions ──────────────────────────────────────────────────────────────
  {
    data: { id: 'mapping_airport_area', label: 'mapping_airport_area', type: 'table', parent: 'regions', primary: true },
    position: { x: 660, y: 150 },
  },
  {
    data: { id: 'countries_areas', label: 'countries_areas', type: 'table', parent: 'regions' },
    position: { x: 660, y: 250 },
  },
  // regions › geography
  {
    data: { id: 'countries_geojson', label: 'countries_geojson', type: 'table', parent: 'geography' },
    position: { x: 600, y: 410 },
  },
  {
    data: { id: 'landmass_areas', label: 'landmass_areas', type: 'table', parent: 'geography' },
    position: { x: 760, y: 410 },
  },
  {
    data: { id: 'oag_regions', label: 'oag_regions', type: 'table', parent: 'geography' },
    position: { x: 680, y: 490 },
  },

  // ── network ──────────────────────────────────────────────────────────────
  {
    data: { id: 'flight_network', label: 'flight_network', type: 'table', parent: 'network' },
    position: { x: 450, y: 300 },
  },
  { data: { id: 'carrier', label: 'carrier', type: 'table', parent: 'network' }, position: { x: 450, y: 380 } },
  // network › fleet
  {
    data: { id: 'aircraft_model', label: 'aircraft_model', type: 'table', parent: 'fleet' },
    position: { x: 450, y: 520 },
  },
  { data: { id: 'seat_map', label: 'seat_map', type: 'table', parent: 'fleet' }, position: { x: 450, y: 600 } },

  // ── external entities ────────────────────────────────────────────────────
  { data: { id: 'aircraft', label: 'aircraft', type: 'external' }, position: { x: 468, y: 60 } },
  { data: { id: 'weather', label: 'weather', type: 'external' }, position: { x: 336, y: 60 } },

  // ── relationships ────────────────────────────────────────────────────────
  { data: { id: 'airport-mapping_airport', source: 'airport', target: 'mapping_airport', label: 'airport_id' } },
  { data: { id: 'runway-airport', source: 'runway', target: 'airport', label: 'airport_id' } },
  { data: { id: 'airport_cycles-airport', source: 'airport_cycles', target: 'airport', label: 'cycle_id' } },
  { data: { id: 'terminal-airport', source: 'terminal', target: 'airport', label: 'airport_id' } },
  { data: { id: 'gate-terminal', source: 'gate', target: 'terminal', label: 'terminal_id' } },
  { data: { id: 'mapping_airport-area', source: 'mapping_airport', target: 'mapping_airport_area', label: 'area_id' } },
  { data: { id: 'countries_areas-area', source: 'countries_areas', target: 'mapping_airport_area', label: 'country_area_id' } },
  { data: { id: 'landmass_areas-countries', source: 'landmass_areas', target: 'countries_areas', label: 'landmass_id' } },
  { data: { id: 'countries_geojson-countries', source: 'countries_geojson', target: 'countries_areas', label: 'iso2' } },
  { data: { id: 'oag_regions-countries', source: 'oag_regions', target: 'countries_areas', label: 'region_id' } },
  { data: { id: 'network-airport', source: 'flight_network', target: 'airport', label: 'origin_airport_id' } },
  { data: { id: 'network-carrier', source: 'flight_network', target: 'carrier', label: 'carrier_id' } },
  { data: { id: 'network-aircraft_model', source: 'flight_network', target: 'aircraft_model', label: 'aircraft_id' } },
  { data: { id: 'aircraft_model-carrier', source: 'aircraft_model', target: 'carrier', label: 'carrier_id' } },
  { data: { id: 'seat_map-aircraft_model', source: 'seat_map', target: 'aircraft_model', label: 'model_id' } },
  { data: { id: 'mapping-weather', source: 'mapping_airport', target: 'weather', label: 'station_id' } },
  { data: { id: 'mapping-aircraft', source: 'mapping_airport', target: 'aircraft', label: 'aircraft_type' } },
]

// Sample columns per node, surfaced in the selection detail panel.
const NODE_COLUMNS: Record<string, string[]> = {
  airport: ['airport_id', 'iata_code', 'icao_code', 'name', 'latitude', 'longitude', 'country_id'],
  mapping_airport: ['mapping_id', 'airport_id', 'area_id', 'station_id', 'aircraft_type', 'updated_at'],
  runway: ['runway_id', 'airport_id', 'length_m', 'width_m', 'surface', 'heading'],
  airport_cycles: ['cycle_id', 'airport_id', 'cycle_date', 'arrivals', 'departures'],
  terminal: ['terminal_id', 'airport_id', 'name', 'concourse', 'gates_count'],
  gate: ['gate_id', 'terminal_id', 'code', 'jet_bridge', 'max_wingspan_m'],
  mapping_airport_area: ['area_id', 'country_area_id', 'region_id', 'geom'],
  countries_areas: ['country_area_id', 'iso2', 'landmass_id', 'name'],
  landmass_areas: ['landmass_id', 'name', 'continent'],
  countries_geojson: ['iso2', 'geometry', 'properties'],
  oag_regions: ['region_id', 'name', 'parent_region_id'],
  flight_network: ['flight_id', 'origin_airport_id', 'carrier_id', 'departure_ts', 'arrival_ts'],
  carrier: ['carrier_id', 'iata', 'icao', 'name', 'country'],
  aircraft_model: ['model_id', 'carrier_id', 'manufacturer', 'model', 'range_km'],
  seat_map: ['seat_map_id', 'model_id', 'cabin', 'rows', 'seats_per_row'],
  aircraft: ['aircraft_type', 'manufacturer', 'model', 'seats'],
  weather: ['station_id', 'observed_at', 'temp_c', 'wind_kt', 'visibility_m'],
}

type SelectedRelation = { key: string; target: string; direction: 'in' | 'out' }
type SelectedNodeInfo = {
  id: string
  label: string
  type: string
  group: string | null
  columns: string[]
  relations: SelectedRelation[]
}

// Collapsed groups use a fixed compact width (model units) instead of keeping
// their full expanded width, so a folded folder is just wide enough for its
// header (label + icons) / "N Items" row.
const COLLAPSED_FOLDER_WIDTH = 110
const COLLAPSED_FOLDER_FALLBACK_WIDTH = 110
const COLLAPSED_FOLDER_BODY_HEIGHT = 22
const FOLDER_HEADER_HEIGHT = 24
const FOLDER_HEADER_GAP = 2
// Space reserved above an open group's box for its header overlay. Kept equal to the header
// height + gap so the box top lands exactly under the header — i.e. an open group's header sits
// on its box just like a collapsed group's header sits on its "N Items" pill.
const FOLDER_OVERLAY_OFFSET = FOLDER_HEADER_HEIGHT + FOLDER_HEADER_GAP
// Padding for a group that contains other groups: the normal tight inset (16px) PLUS the header band
// (FOLDER_OVERLAY_OFFSET) so a nested group's header overlay drops into its own clear strip below
// this group's header instead of stacking on top of it.
const SUBGROUP_HEADER_PADDING = 16 + FOLDER_OVERLAY_OFFSET
// Gap kept between adjacent top-level containers. Generous enough that the aggregated cross-group
// link labels (e.g. "area_id") sit in clear space rather than colliding with neighbouring folders.
const CONTAINER_OVERLAP_GAP = 56
// Tighter gap used between siblings INSIDE a group (a leaf node vs a subgroup folder, etc.).
const INNER_SIBLING_GAP = 20
// Default view zoom. Kept at 1:1 so the fixed-pixel folder overlays line up with the model-space
// group rectangles — at any other zoom a collapsed subgroup's folder spills past its parent's
// padding (smaller zoom) or the entity nodes balloon relative to the folders (larger zoom).
const DEFAULT_VIEW_ZOOM = 1

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
        'text-margin-y': -3,
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
        'bounds-expansion': '0px',
        'compound-sizing-wrt-labels': 'include',
        color: muted,
        content: '',
        'font-size': 12,
        'font-weight': 700,
        // The header (label + icons) is an HTML overlay sitting just above the box, so the
        // compound should hug its children: no forced min-height (which used to reserve a tall
        // empty band at the top) and a tight, symmetric padding — mirroring how a collapsed
        // group's "N Items" pill sits right under its header.
        'min-height': '0px',
        'min-width': '200px',
        'min-width-bias-left': '50%',
        padding: '16px',
        'text-halign': 'left',
        'text-margin-x': -28,
        'text-margin-y': -24,
        'text-valign': 'top',
      },
    },
    {
      // A group that itself contains other groups needs extra room at the top: every nested group's
      // header is an HTML overlay sitting ~28px ABOVE its own box, so without this band the child
      // header would ride up into the parent's header. The padding reserves a clear strip for it.
      selector: 'node[type = "domain"].has-subgroups',
      style: {
        padding: `${SUBGROUP_HEADER_PADDING}px`,
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
    componentSpacing: 70,
    edgeElasticity: () => 60,
    fit: true,
    gravity: 0.45,
    idealEdgeLength: () => 70,
    nestingFactor: 0.9,
    nodeDimensionsIncludeLabels: true,
    nodeOverlap: 18,
    nodeRepulsion: () => 3800,
    numIter: animate ? 900 : 1800,
    padding: 30,
    randomize: false,
    refresh: animate ? 12 : 30,
    spacingFactor: 0.85,
  })

  if (onStop) layout.one('layoutstop', onStop)
  layout.run()
}

/** True when any ancestor group of the node is collapsed or hidden, i.e. the node is folded away. */
function isFoldedAway(node: NodeSingular): boolean {
  return node.ancestors().some((ancestor) => {
    const group = ancestor as NodeSingular
    return group.hasClass('is-folder-collapsed') || group.hasClass('is-folder-hidden')
  })
}

/** Whether a node should be drawn: it isn't hidden itself and no ancestor folds it away. */
function isNodeRendered(node: NodeSingular): boolean {
  if (node.hasClass('is-folder-hidden')) return false
  return !isFoldedAway(node)
}

/**
 * Recomputes `display` for every node and edge from the collapse/hidden classes. A node renders
 * unless it (or any ancestor) is hidden, or an ancestor group is collapsed. A collapsed group is
 * itself still rendered (as a compact folder); only its descendants fold away. An edge renders
 * only when both endpoints render. Works for arbitrarily deep nesting.
 */
function applyVisibility(cy: Core) {
  cy.batch(() => {
    cy.nodes().forEach((node) => {
      node.style('display', isNodeRendered(node) ? 'element' : 'none')
    })
    cy.edges().forEach((edge) => {
      const shouldShow = isNodeRendered(edge.source()) && isNodeRendered(edge.target())
      edge.style('display', shouldShow ? 'element' : 'none')
    })
  })
}

/**
 * Invalidates every group's cached compound bounding box so the next read/render recomputes it.
 * Cytoscape doesn't reliably invalidate an ANCESTOR group's bounds when a descendant moves while
 * hidden (which happens when we re-place a folded group's children as it opens), nor always after a
 * batched reposition — leaving a parent that fails to grow around a freshly expanded subgroup. This
 * clears the cache up the whole hierarchy without moving anything, so groups resize to fit.
 */
function refreshCompoundBounds(cy: Core) {
  cy.nodes().forEach((node) => {
    ;(node as unknown as { dirtyCompoundBoundsCache?: () => void }).dirtyCompoundBoundsCache?.()
  })
}

/**
 * Collapses a group by clustering its direct children onto its centre (remembering each child's
 * offset so it can be restored). Cytoscape won't reposition a compound whose children are all
 * hidden, so without this a folded group would keep a stale position and drift outside its parent.
 * Clustering instead gives the collapsed compound a real, compact footprint at a well-defined point,
 * which its own parent then sizes around natively. A child that is itself a (collapsed) subgroup
 * moves as a unit, so nested folds stay intact.
 */
function collapseGroup(domain: NodeSingular) {
  if (domain.hasClass('is-folder-collapsed')) return
  const center = domain.position()
  domain.children().forEach((child) => {
    const position = child.position()
    child.data({ preCollapseDx: position.x - center.x, preCollapseDy: position.y - center.y })
    child.position({ x: center.x, y: center.y })
  })
  domain.addClass('is-folder-collapsed')
}

/** Re-opens a group, restoring its direct children to the offsets recorded when it was collapsed. */
function expandGroup(domain: NodeSingular) {
  if (!domain.hasClass('is-folder-collapsed')) return
  const center = domain.position()
  domain.children().forEach((child) => {
    const dx = Number(child.data('preCollapseDx')) || 0
    const dy = Number(child.data('preCollapseDy')) || 0
    child.position({ x: center.x + dx, y: center.y + dy })
  })
  domain.removeClass('is-folder-collapsed')
}

/** Collapses every group (deepest first, so each fold nests cleanly) for a fully-folded default. */
function collapseAllDomainFolders(cy: Core) {
  const deepestFirst = cy
    .nodes('[type = "domain"]')
    .sort((a, b) => (b as NodeSingular).ancestors().length - (a as NodeSingular).ancestors().length)
  cy.batch(() => {
    deepestFirst.forEach((domain) => collapseGroup(domain as NodeSingular))
  })
  applyVisibility(cy)
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
function getDomainFolderRenderedBox(domain: NodeSingular): GraphBox {
  const box = domain.renderedBoundingBox({
    includeEdges: false,
    includeLabels: false,
    includeNodes: true,
    includeOverlays: false,
    includeUnderlays: false,
  })

  if (domain.hasClass('is-folder-collapsed')) {
    // The folded compound is clustered + compact, so its live box centre is reliable.
    const centerX = (box.x1 + box.x2) / 2
    const centerY = (box.y1 + box.y2) / 2
    const width = COLLAPSED_FOLDER_WIDTH
    const x1 = centerX - width / 2
    const bodyTop = centerY - COLLAPSED_FOLDER_BODY_HEIGHT / 2
    const top = bodyTop - FOLDER_HEADER_GAP - FOLDER_HEADER_HEIGHT
    const bottom = centerY + COLLAPSED_FOLDER_BODY_HEIGHT / 2
    return { x1, x2: x1 + width, y1: top, y2: bottom }
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

function getContainerRenderedBox(node: NodeSingular): GraphBox {
  return node.data('type') === 'domain' ? getDomainFolderRenderedBox(node) : getEntityRenderedBox(node)
}

/**
 * Translates a node (and everything it visually contains) by a model delta. Cytoscape only relays a
 * position change to children that are *visible*, so the rule differs by kind:
 *  - an OPEN group: recurse into its children (the group node re-centres on them);
 *  - a FOLDED group: set its own position directly — its children are hidden and clustered, and will
 *    be re-placed relative to this position when it is later expanded;
 *  - a leaf / external node: move it outright.
 * This keeps a group and its folded subgroups moving as one rigid unit at any nesting depth.
 */
function translateNode(node: NodeSingular, modelDx: number, modelDy: number) {
  if (node.data('type') === 'domain' && !node.hasClass('is-folder-collapsed')) {
    node.children().forEach((child) => translateNode(child as NodeSingular, modelDx, modelDy))
    return
  }
  const position = node.position()
  node.position({ x: position.x + modelDx, y: position.y + modelDy })
}

/** Moves a whole container (a domain and its descendants, or a single external node) in model space. */
function shiftContainer(cy: Core, node: NodeSingular, modelDx: number, modelDy: number) {
  cy.batch(() => translateNode(node, modelDx, modelDy))
}

/**
 * Iteratively pushes a set of sibling nodes apart until no two overlap (keeping `gap` between them).
 * Each sibling is measured by its full footprint — a folded group counts as its compact folder box
 * (header included), an open group as its whole rectangle, a leaf as its node+label box — and moved
 * as a rigid unit, so this works for any mix of nodes and (collapsed or open) subgroups.
 */
function separateSiblings(cy: Core, siblings: NodeSingular[], gap: number) {
  const zoom = cy.zoom()
  const nodes = siblings.filter((node) => node.visible())
  if (nodes.length < 2) return

  const maxPasses = 16
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let moved = false
    // Group boxes are cached; a sibling moved in the previous pass (or a subgroup just expanded) may
    // leave a stale box, so clear the cache before re-measuring this pass.
    refreshCompoundBounds(cy)
    const items = nodes.map((node) => ({ node, box: getContainerRenderedBox(node) }))

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
          const push = (overlapX + gap) / 2 / zoom
          const direction = aCenterX <= bCenterX ? -1 : 1
          shiftContainer(cy, a.node, direction * push, 0)
          shiftContainer(cy, b.node, -direction * push, 0)
        } else {
          const push = (overlapY + gap) / 2 / zoom
          const direction = aCenterY <= bCenterY ? -1 : 1
          shiftContainer(cy, a.node, 0, direction * push)
          shiftContainer(cy, b.node, 0, -direction * push)
        }

        a.box = getContainerRenderedBox(a.node)
        b.box = getContainerRenderedBox(b.node)
        moved = true
      }
    }

    if (!moved) break
  }
}

/**
 * Resolves overlaps at every level of the hierarchy: inside each open group its children (leaf nodes
 * AND folded/open subgroups) are spread apart, then the top-level containers are. Deepest groups go
 * first so a group has already settled its own contents — and grown to fit them — before it is
 * separated from its own siblings one level up.
 */
function resolveContainerOverlaps(cy: Core) {
  const openGroups = cy
    .nodes('[type = "domain"]:visible')
    .filter((group) => !(group as NodeSingular).hasClass('is-folder-collapsed'))
    .sort((a, b) => (b as NodeSingular).ancestors().length - (a as NodeSingular).ancestors().length)

  openGroups.forEach((group) => {
    const children = (group as NodeSingular).children().map((child) => child as NodeSingular)
    separateSiblings(cy, children, INNER_SIBLING_GAP)
  })

  const topLevel = cy
    .nodes()
    .filter((node) => (node as NodeSingular).parent().empty() && (node as NodeSingular).visible())
    .map((node) => node as NodeSingular)
  separateSiblings(cy, topLevel, CONTAINER_OVERLAP_GAP)

  // After all the repositioning, clear the bounds cache once more so the final render and the folder
  // overlays (which read group boxes) reflect every group's settled size.
  refreshCompoundBounds(cy)
}

/**
 * Uniformly shrinks the top-level containers toward their shared centroid so the folded layout fits
 * the viewport comfortably at a 1:1 zoom, while preserving the force layout's relative arrangement
 * (every container keeps its direction from the centroid — only distances scale). The force layout
 * spaced things for EXPANDED groups, so folded they leave a lot of slack; this reclaims it without
 * blobbing them together the way a per-pair gravity pull would. Runs in model space (positions),
 * independent of the current zoom; resolveContainerOverlaps afterwards guarantees clear gaps.
 */
function compactContainers(cy: Core) {
  const containers = cy.nodes().filter((node: NodeSingular) => node.parent().empty() && node.visible())
  if (containers.length < 2) return

  const centers = containers.map((node: NodeSingular) => {
    const position = node.position()
    return { node, x: position.x, y: position.y }
  })
  const minX = Math.min(...centers.map((c) => c.x))
  const maxX = Math.max(...centers.map((c) => c.x))
  const minY = Math.min(...centers.map((c) => c.y))
  const maxY = Math.max(...centers.map((c) => c.y))
  const spanX = maxX - minX
  const spanY = maxY - minY

  // Target span of the centre-points, in model units (== screen px at 1:1). Leaves room around them
  // for the fixed-size folders and their labels within the visible canvas.
  const targetX = cy.width() * 0.5
  const targetY = cy.height() * 0.42
  const scale = Math.min(1, spanX > 0 ? targetX / spanX : 1, spanY > 0 ? targetY / spanY : 1)
  if (scale >= 0.999) return

  const centroidX = centers.reduce((sum, c) => sum + c.x, 0) / centers.length
  const centroidY = centers.reduce((sum, c) => sum + c.y, 0) / centers.length

  cy.batch(() => {
    centers.forEach((c) => {
      shiftContainer(cy, c.node, (scale - 1) * (c.x - centroidX), (scale - 1) * (c.y - centroidY))
    })
  })
}

/**
 * Re-arranges an open group's children into a compact grid centred on where they already are. The
 * force layout spreads them apart (their cross-group edges tug each toward a distant neighbour),
 * leaving a big half-empty box — and a uniform shrink keeps whatever long line it produced. A small
 * grid packs them into a tidy block instead. Cells are sized to the largest child (a folded subgroup
 * counts as its compact folder, with extra row height for its header strip); rows/cols stay roughly
 * square. resolveContainerOverlaps afterwards only has to confirm the (already clear) gaps.
 */
function compactGroupChildren(cy: Core, group: NodeSingular) {
  const children = group
    .children()
    .filter((child) => (child as NodeSingular).visible())
    .map((child) => child as NodeSingular)
  if (children.length < 2) return

  const zoom = cy.zoom() || 1
  const boxes = children.map((child) => {
    const box = getContainerRenderedBox(child)
    return { child, w: box.x2 - box.x1, h: box.y2 - box.y1, cx: (box.x1 + box.x2) / 2, cy: (box.y1 + box.y2) / 2 }
  })

  const cellW = Math.max(...boxes.map((b) => b.w)) + INNER_SIBLING_GAP
  const cellH = Math.max(...boxes.map((b) => b.h)) + INNER_SIBLING_GAP + FOLDER_OVERLAY_OFFSET
  const cols = Math.ceil(Math.sqrt(children.length))
  const rows = Math.ceil(children.length / cols)
  const gridW = cols * cellW
  const gridH = rows * cellH

  // Centre the grid on the children's current centroid so the group barely shifts overall.
  const centroidX = boxes.reduce((sum, b) => sum + b.cx, 0) / boxes.length
  const centroidY = boxes.reduce((sum, b) => sum + b.cy, 0) / boxes.length

  cy.batch(() => {
    boxes.forEach((b, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const targetX = centroidX - gridW / 2 + cellW * (col + 0.5)
      const targetY = centroidY - gridH / 2 + cellH * (row + 0.5)
      shiftContainer(cy, b.child, (targetX - b.cx) / zoom, (targetY - b.cy) / zoom)
    })
  })
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
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null)

  const syncFolderOverlays = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return

    const overlays = cy.nodes('[type = "domain"]:visible').map((domain) => {
      const isCollapsed = domain.hasClass('is-folder-collapsed')
      const box = domain.renderedBoundingBox({
        includeEdges: false,
        includeLabels: false,
        includeNodes: true,
        includeOverlays: false,
        includeUnderlays: false,
      })

      const base = {
        collapsed: isCollapsed,
        faded: domain.hasClass('is-faded'),
        id: domain.id(),
        itemCount: domain.descendants('node[type != "domain"]').length,
        label: String(domain.data('label')),
      }

      if (!isCollapsed) {
        return { ...base, height: box.h, width: box.w, x: box.x1, y: box.y1 }
      }

      // A folded group is a fixed-size compact folder centred on its live (clustered, compact)
      // node box — so it sits exactly where Cytoscape reserves space, which keeps it inside its
      // still-open parent at any nesting depth.
      const centerX = (box.x1 + box.x2) / 2
      const centerY = (box.y1 + box.y2) / 2
      return {
        ...base,
        height: COLLAPSED_FOLDER_BODY_HEIGHT,
        width: COLLAPSED_FOLDER_WIDTH,
        x: centerX - COLLAPSED_FOLDER_WIDTH / 2,
        y: centerY - COLLAPSED_FOLDER_BODY_HEIGHT / 2,
      }
    })

    setFolderOverlays(overlays)

    // Aggregated cross-group links: keep a relationship visible whenever at least one of its
    // endpoints is folded away. Each endpoint anchors on the OUTERMOST collapsed group that hides
    // it (so the line leaves that folder), or on the exact item when fully open. Works at any
    // nesting depth and merges duplicates that resolve to the same pair of anchors.
    const folderBoxIndex: Record<string, GraphBox> = {}
    overlays.forEach((folder) => {
      const height = folder.collapsed ? COLLAPSED_FOLDER_BODY_HEIGHT : folder.height
      folderBoxIndex[folder.id] = { x1: folder.x, x2: folder.x + folder.width, y1: folder.y, y2: folder.y + height }
    })

    const nodeBoxIndex: Record<string, GraphBox> = {}
    cy.nodes('[type != "domain"]:visible').forEach((node) => {
      nodeBoxIndex[node.id()] = getEntityRenderedBox(node)
    })

    type Anchor = { key: string; box: GraphBox; folded: boolean }
    const anchorForEndpoint = (node: NodeSingular): Anchor | null => {
      const ancestors = node.ancestors()
      if (node.hasClass('is-folder-hidden') || ancestors.some((a) => (a as NodeSingular).hasClass('is-folder-hidden'))) {
        return null
      }

      const collapsed = ancestors.filter((a) => (a as NodeSingular).hasClass('is-folder-collapsed'))
      if (collapsed.nonempty()) {
        // The outermost collapsed group (closest to the root) is the one that actually hides the node.
        const outer = collapsed.min((a) => (a as NodeSingular).ancestors().length).ele as NodeSingular
        const box = folderBoxIndex[outer.id()]
        return box ? { key: outer.id(), box, folded: true } : null
      }
      const box = nodeBoxIndex[node.id()]
      return box ? { key: node.id(), box, folded: false } : null
    }

    const grouped = new Map<string, { source: GraphBox; target: GraphBox; labels: string[] }>()
    cy.edges().forEach((edge) => {
      const source = anchorForEndpoint(edge.source())
      const target = anchorForEndpoint(edge.target())
      if (!source || !target) return
      if (source.key === target.key) return // both fold into the same group
      if (!source.folded && !target.folded) return // both open -> the real table edge carries it

      const key = `${source.key}::${target.key}`
      const label = String(edge.data('label') ?? '')
      const existing = grouped.get(key)
      if (existing) {
        if (label) existing.labels.push(label)
        return
      }
      grouped.set(key, { source: source.box, target: target.box, labels: label ? [label] : [] })
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

    // Expanding only reveals one level: any nested groups stay collapsed (their own
    // class keeps them folded) until the user opens them in turn.
    const expanding = domain.hasClass('is-folder-collapsed')
    if (expanding) {
      expandGroup(domain as NodeSingular)
    } else {
      collapseGroup(domain as NodeSingular)
    }

    applyVisibility(cy)
    // Pull the just-revealed children together so the open group is tight instead of inheriting the
    // force layout's cross-group sprawl; resolveContainerOverlaps then restores the minimum gaps.
    if (expanding) compactGroupChildren(cy, domain as NodeSingular)
    resolveContainerOverlaps(cy)
    syncFolderOverlays()
  }, [syncFolderOverlays])

  const hideFolder = useCallback((domainId: string) => {
    const cy = cyRef.current
    const domain = cy?.getElementById(domainId)
    if (!cy || !domain?.nonempty()) return

    domain.addClass('is-folder-hidden')
    setHiddenDomains((prev) =>
      prev.some((item) => item.id === domainId)
        ? prev
        : [...prev, { id: domainId, label: String(domain.data('label')) }],
    )
    applyVisibility(cy)
    resolveContainerOverlaps(cy)
    syncFolderOverlays()
  }, [syncFolderOverlays])

  const showFolder = useCallback((domainId: string) => {
    const cy = cyRef.current
    const domain = cy?.getElementById(domainId)
    if (!cy || !domain?.nonempty()) return

    // Reveal the group again. Its own collapse state (and that of any nested
    // groups) is preserved, so applyVisibility restores exactly what was folded.
    domain.removeClass('is-folder-hidden')
    setHiddenDomains((prev) => prev.filter((item) => item.id !== domainId))
    applyVisibility(cy)
    resolveContainerOverlaps(cy)
    syncFolderOverlays()
  }, [syncFolderOverlays])

  const showAllHidden = useCallback(() => {
    hiddenDomains.forEach((item) => showFolder(item.id))
  }, [hiddenDomains, showFolder])

  const clearSelection = useCallback(() => {
    const cy = cyRef.current
    if (cy) {
      cy.elements().removeClass('is-faded')
      cy.elements().unselect()
    }
    setSelectedNode(null)
  }, [])

  const moveFolderBy = useCallback((domainId: string, renderedDx: number, renderedDy: number) => {
    const cy = cyRef.current
    const domain = cy?.getElementById(domainId)
    if (!cy || !domain?.nonempty()) return

    const zoom = cy.zoom()
    shiftContainer(cy, domain as NodeSingular, renderedDx / zoom, renderedDy / zoom)
    // Refresh group bounds every drag step (not just on release) so a parent rectangle and its header
    // track the moved group live, instead of lagging behind and momentarily overlapping it.
    refreshCompoundBounds(cy)
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

    // Flag groups that directly contain another group so they reserve a header strip for it.
    cy.nodes('[type = "domain"]').forEach((domain) => {
      if (domain.children('[type = "domain"]').nonempty()) domain.addClass('has-subgroups')
    })

    runCollisionSafeLayout(cy, false, () => {
      collapseAllDomainFolders(cy)
      // Pin the display to a 1:1 zoom, then pack the folded containers to fit at that scale. Folder
      // overlays are a fixed PIXEL size while groups size in MODEL space; only at 1:1 do a collapsed
      // subgroup's 110px body and 28px header sit within its parent's (model-space) padding instead
      // of spilling out — and entity nodes read at the same scale as the folders.
      cy.zoom(DEFAULT_VIEW_ZOOM)
      compactContainers(cy)
      resolveContainerOverlaps(cy)
      cy.center()
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

      const relations: SelectedRelation[] = node.connectedEdges().map((edge: EdgeSingular) => {
        const isSource = edge.source().id() === node.id()
        const other = isSource ? edge.target() : edge.source()
        return {
          key: String(edge.data('label')),
          target: String(other.data('label')),
          direction: isSource ? 'out' : 'in',
        }
      })
      setSelectedNode({
        id: node.id(),
        label: String(node.data('label')),
        type: String(node.data('type')),
        group: node.parent().nonempty() ? String(node.parent().data('label')) : null,
        columns: NODE_COLUMNS[node.id()] ?? [],
        relations,
      })
    })

    cy.on('tap', (event) => {
      const target = event.target
      // Deselect on a tap anywhere that isn't a selectable entity node: the empty
      // canvas, a group (domain) background, or an edge all clear the selection.
      const isEntityNode =
        target !== cy &&
        typeof target.isNode === 'function' &&
        target.isNode() &&
        target.data('type') !== 'domain'
      if (!isEntityNode) {
        cy.elements().removeClass('is-faded')
        setSelectedNode(null)
      }
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
      {selectedNode && (
        <aside className="edr-detail" aria-label={`${selectedNode.label} details`}>
          <header className="edr-detail__head">
            <div>
              <span className="edr-detail__type">{selectedNode.type}</span>
              <h2>{selectedNode.label}</h2>
            </div>
            <button aria-label="Close details" onClick={clearSelection} type="button">
              <X size={16} strokeWidth={2} />
            </button>
          </header>
          {selectedNode.group && (
            <div className="edr-detail__row">
              <span className="edr-detail__label">Group</span>
              <span className="edr-detail__value">{selectedNode.group}</span>
            </div>
          )}
          <div className="edr-detail__section">
            <span className="edr-detail__label">Columns ({selectedNode.columns.length})</span>
            <ul className="edr-detail__columns">
              {selectedNode.columns.map((column) => (
                <li key={column}>{column}</li>
              ))}
            </ul>
          </div>
          <div className="edr-detail__section">
            <span className="edr-detail__label">Relations ({selectedNode.relations.length})</span>
            <ul className="edr-detail__relations">
              {selectedNode.relations.map((relation, index) => (
                <li key={`${relation.target}-${relation.key}-${index}`}>
                  <span className="edr-detail__rel-dir">{relation.direction === 'out' ? '→' : '←'}</span>
                  <span className="edr-detail__rel-target">{relation.target}</span>
                  <span className="edr-detail__rel-key">{relation.key}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
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
