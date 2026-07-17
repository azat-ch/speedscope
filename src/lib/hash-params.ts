import {ViewMode} from '../lib/view-mode'

export interface HashParams {
  profileURL?: string
  title?: string
  localProfilePath?: string
  viewMode?: ViewMode
  reverse?: boolean
  searchQuery?: string
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

export function saveViewModeToHash(viewMode: ViewMode): void {
  window.history.replaceState(null, '', hashWithViewMode(window.location.hash, viewMode))
}

export function saveReverseToHash(reverse: boolean): void {
  window.history.replaceState(
    null,
    '',
    hashWithParam(window.location.hash, 'reverse', reverse ? 'true' : null),
  )
}

// null removes the parameter (search closed or empty query)
export function saveSearchQueryToHash(searchQuery: string | null): void {
  window.history.replaceState(
    null,
    '',
    hashWithParam(
      window.location.hash,
      'search',
      searchQuery === null ? null : encodeURIComponent(searchQuery),
    ),
  )
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
      } else if (key === 'reverse') {
        result.reverse = value === 'true' || value === '1'
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
