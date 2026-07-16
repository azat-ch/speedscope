import {ViewMode} from '../lib/view-mode'

export interface HashParams {
  profileURL?: string
  title?: string
  localProfilePath?: string
  viewMode?: ViewMode
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

// Returns the hash fragment with the view= component replaced (or appended),
// leaving all other components byte-for-byte intact so that values which are
// not strictly URI-encoded (e.g. profileURL) survive the round-trip.
export function hashWithViewMode(hashContents: string, viewMode: ViewMode): string {
  const viewComponent = `view=${viewModeToString(viewMode)}`
  const body = hashContents.startsWith('#') ? hashContents.substr(1) : ''
  if (body.length === 0) {
    return `#${viewComponent}`
  }
  const components = body.split('&')
  let found = false
  for (let i = 0; i < components.length; i++) {
    if (components[i].startsWith('view=')) {
      components[i] = viewComponent
      found = true
    }
  }
  if (!found) {
    components.push(viewComponent)
  }
  return '#' + components.join('&')
}

export function saveViewModeToHash(viewMode: ViewMode): void {
  window.history.replaceState(null, '', hashWithViewMode(window.location.hash, viewMode))
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
