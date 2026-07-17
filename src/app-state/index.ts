import {Atom} from '../lib/atom'
import {ViewMode} from '../lib/view-mode'
import {
  getHashParams,
  HashParams,
  saveFlattenToHash,
  saveReverseToHash,
  saveSearchQueryToHash,
  saveSelectedToHash,
  saveViewModeToHash,
} from '../lib/hash-params'
import {getCallTreeNodeIndexPath} from '../lib/profile'
import {ProfileGroupAtom} from './profile-group'
import {Vec2} from '../lib/math'

// Parameters defined by the URL encoded k=v pairs after the # in the URL
const hashParams = getHashParams()
export const hashParamsAtom = new Atom<HashParams>(hashParams, 'hashParams')

// True if recursion should be flattened when viewing flamegraphs
export const flattenRecursionAtom = new Atom<boolean>(
  hashParams.flatten === true,
  'flattenRecursion',
)

flattenRecursionAtom.subscribe(() => {
  saveFlattenToHash(flattenRecursionAtom.get())
})

// True if the left heavy view should merge stacks leaf-first (reverse
// flamegraph, as in flamegraph.pl --reverse)
export const reverseFlamegraphAtom = new Atom<boolean>(
  hashParams.reverse === true,
  'reverseFlamegraph',
)

reverseFlamegraphAtom.subscribe(() => {
  saveReverseToHash(reverseFlamegraphAtom.get())
})

// The query used in top-level views
//
// An empty string indicates that the search is open by no filter is applied.
// searchIsActive is stored separately, because we may choose to persist the
// query even when the search input is closed.
export const searchIsActiveAtom = new Atom<boolean>(
  hashParams.searchQuery != null,
  'searchIsActive',
)
export const searchQueryAtom = new Atom<string>(hashParams.searchQuery || '', 'searchQueryAtom')

// Pending search match (1-based) to restore from the URL. One-shot: the
// search view consumes it (sets it to null) once results are available.
export const searchMatchToRestoreAtom = new Atom<number | null>(
  hashParams.searchMatch != null ? hashParams.searchMatch : null,
  'searchMatchToRestore',
)

function saveSearchToHash() {
  const query = searchIsActiveAtom.get() ? searchQueryAtom.get() : ''
  saveSearchQueryToHash(query.length > 0 ? query : null)
}
searchIsActiveAtom.subscribe(saveSearchToHash)
searchQueryAtom.subscribe(saveSearchToHash)

// Which top-level view should be displayed
export const viewModeAtom = new Atom<ViewMode>(ViewMode.CHRONO_FLAME_CHART, 'viewMode')

// The top-level profile group from which most other data will be derived
export const profileGroupAtom = new ProfileGroupAtom(null, 'profileGroup')

viewModeAtom.subscribe(() => {
  // If we switch views, the hover information is no longer relevant
  profileGroupAtom.clearHoverNode()

  // Persist the selected view in the URL so it survives reload & sharing
  saveViewModeToHash(viewModeAtom.get())
})

// Pending selection to restore from the URL: a dot-separated calltree index
// path for flamechart views, or a frame key for the sandwich view. One-shot:
// the active view consumes it (sets it to null) once it can resolve it.
export const selectedToRestoreAtom = new Atom<string | null>(
  hashParams.selected != null ? hashParams.selected : null,
  'selectedToRestore',
)

function syncSelectedToHash() {
  // Don't clobber the selected= parameter before it has been restored
  if (selectedToRestoreAtom.get() != null) return

  let value: string | null = null
  const profileState = profileGroupAtom.getActiveProfile()
  if (profileState != null) {
    switch (viewModeAtom.get()) {
      case ViewMode.CHRONO_FLAME_CHART: {
        const node = profileState.chronoViewState.selectedNode
        if (node != null) value = getCallTreeNodeIndexPath(node).join('.')
        break
      }
      case ViewMode.LEFT_HEAVY_FLAME_GRAPH: {
        const node = profileState.leftHeavyViewState.selectedNode
        if (node != null) value = getCallTreeNodeIndexPath(node).join('.')
        break
      }
      case ViewMode.SANDWICH_VIEW: {
        const frame = profileState.sandwichViewState.callerCallee?.selectedFrame
        if (frame != null) value = String(frame.key)
        break
      }
    }
  }
  saveSelectedToHash(value)
}
viewModeAtom.subscribe(syncSelectedToHash)
profileGroupAtom.subscribe(syncSelectedToHash)

// The <canvas> element used for WebGL
export const glCanvasAtom = new Atom<HTMLCanvasElement | null>(null, 'glCanvas')

// True when a file drag is currently active. Used to indicate that the
// application is a valid drop target.
export const dragActiveAtom = new Atom<boolean>(false, 'dragActive')

// True when the application is currently in a loading state. Used to
// display a loading progress bar.

// Speedscope is usable both from a local HTML file being served
// from a file:// URL, and via websites. In the case of file:// URLs,
// however, XHR will be unavailable to fetching files in adjacent directories.
const protocol = window.location.protocol
export const canUseXHR = protocol === 'http:' || protocol === 'https:'
const isImmediatelyLoading = canUseXHR && hashParams.profileURL != null
export const loadingAtom = new Atom<boolean>(isImmediatelyLoading, 'loading')

// True when the application is an error state, e.g. because the profile
// imported was invalid.
export const errorAtom = new Atom<boolean>(false, 'error')

// Minimap mouse position so we can zoom around mouse origin relative to minimap
export const minimapMousePositionAtom = new Atom<Vec2 | null>(null, 'minimapMousePosition')

export enum SortField {
  SYMBOL_NAME,
  SELF,
  TOTAL,
}

export enum SortDirection {
  ASCENDING,
  DESCENDING,
}

export interface SortMethod {
  field: SortField
  direction: SortDirection
}

// The table sorting method using for the sandwich view, specifying the column
// to sort by, and the direction to sort that clumn.
export const tableSortMethodAtom = new Atom<SortMethod>(
  {
    field: SortField.SELF,
    direction: SortDirection.DESCENDING,
  },
  'tableSortMethod',
)
