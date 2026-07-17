import {ViewMode} from '../lib/view-mode'

export interface HashParams {
  profileURL?: string
  title?: string
  localProfilePath?: string
  viewMode?: ViewMode
  reverse?: boolean
  flatten?: boolean
  searchQuery?: string
  // 1-based index of the search match to select, as displayed in the search box
  searchMatch?: number
  // Selection to restore: a dot-separated calltree index path for flamechart
  // views, or a frame key for the sandwich view
  selected?: string
}

function getViewMode(value: string): ViewMode | null {
  switch (value) {
    case 'time-ordered':
      return ViewMode.CHRONO_FLAME_CHART
    case 'left-heavy':
      return ViewMode.LEFT_HEAVY_FLAME_GRAPH
    case 'sandwich':
      return ViewMode.SANDWICH_VIEW
    default:
      return null
  }
}

function viewModeToString(viewMode: ViewMode): string {
  switch (viewMode) {
    case ViewMode.CHRONO_FLAME_CHART:
      return 'time-ordered'
    case ViewMode.LEFT_HEAVY_FLAME_GRAPH:
      return 'left-heavy'
    case ViewMode.SANDWICH_VIEW:
      return 'sandwich'
  }
}

// Returns the hash fragment with the key= component replaced, appended, or
// removed (value === null), leaving all other components byte-for-byte intact
// so that values which are not strictly URI-encoded (e.g. profileURL) survive
// the round-trip.
export function hashWithParam(hashContents: string, key: string, value: string | null): string {
  const body = hashContents.startsWith('#') ? hashContents.substr(1) : ''
  const component = value === null ? null : `${key}=${value}`
  const components: string[] = []
  let found = false
  for (const c of body.length === 0 ? [] : body.split('&')) {
    if (c.startsWith(`${key}=`)) {
      found = true
      if (component !== null) {
        components.push(component)
      }
    } else {
      components.push(c)
    }
  }
  if (!found && component !== null) {
    components.push(component)
  }
  return '#' + components.join('&')
}

export function hashWithViewMode(hashContents: string, viewMode: ViewMode): string {
  return hashWithParam(hashContents, 'view', viewModeToString(viewMode))
}

// No-op when the hash already contains the desired value: callers may be
// invoked from high-frequency state changes (e.g. hovers), and browsers
// throttle history.replaceState
function replaceHashParam(key: string, value: string | null): void {
  const newHash = hashWithParam(window.location.hash, key, value)
  if (newHash === (window.location.hash || '#')) return
  window.history.replaceState(null, '', newHash)
}

export function saveViewModeToHash(viewMode: ViewMode): void {
  replaceHashParam('view', viewModeToString(viewMode))
}

export function saveReverseToHash(reverse: boolean): void {
  replaceHashParam('reverse', reverse ? 'true' : null)
}

export function saveFlattenToHash(flatten: boolean): void {
  replaceHashParam('flatten', flatten ? 'true' : null)
}

// null removes the parameter (no match selected)
export function saveSearchMatchToHash(searchMatch: number | null): void {
  replaceHashParam('match', searchMatch === null ? null : searchMatch.toString())
}

// null removes the parameter (search closed or empty query)
export function saveSearchQueryToHash(searchQuery: string | null): void {
  replaceHashParam('search', searchQuery === null ? null : encodeURIComponent(searchQuery))
}

// null removes the parameter (nothing selected)
export function saveSelectedToHash(selected: string | null): void {
  replaceHashParam('selected', selected === null ? null : encodeURIComponent(selected))
}

export function getHashParams(hashContents = window.location.hash): HashParams {
  try {
    if (!hashContents.startsWith('#')) {
      return {}
    }
    const components = hashContents.substr(1).split('&')
    const result: HashParams = {}
    for (const component of components) {
      const eqIndex = component.indexOf('=')
      if (eqIndex === -1) continue
      const key = component.substring(0, eqIndex)
      let value = component.substring(eqIndex + 1)
      value = decodeURIComponent(value)
      if (key === 'profileURL') {
        result.profileURL = value
      } else if (key === 'title') {
        result.title = value
      } else if (key === 'localProfilePath') {
        result.localProfilePath = value
      } else if (key === 'search') {
        result.searchQuery = value
      } else if (key === 'match') {
        const searchMatch = parseInt(value, 10)
        if (!isNaN(searchMatch) && searchMatch > 0) {
          result.searchMatch = searchMatch
        }
      } else if (key === 'selected') {
        if (value.length > 0) {
          result.selected = value
        }
      } else if (key === 'reverse') {
        result.reverse = value === 'true' || value === '1'
      } else if (key === 'flatten') {
        result.flatten = value === 'true' || value === '1'
      } else if (key === 'view') {
        const mode = getViewMode(value)
        if (mode !== null) {
          result.viewMode = mode
        } else {
          console.error(`Ignoring invalid view specifier: ${value}`)
        }
      }
    }
    return result
  } catch (e) {
    console.error(`Error when loading hash fragment.`)
    console.error(e)
    return {}
  }
}
