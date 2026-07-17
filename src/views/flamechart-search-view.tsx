import {memo} from 'preact/compat'
import {useContext, useMemo, useCallback, useEffect} from 'preact/hooks'
import {SearchView, ProfileSearchContext} from './search-view'
import {searchMatchToRestoreAtom} from '../app-state'
import {useAtom} from '../lib/atom'
import {saveSearchMatchToHash} from '../lib/hash-params'
import {
  FlamechartSearchMatch,
  FlamechartSearchResults,
  ProfileSearchResults,
} from '../lib/profile-search'
import {Rect, Vec2} from '../lib/math'
import {h, createContext, ComponentChildren} from 'preact'
import {Flamechart} from '../lib/flamechart'
import {CallTreeNode} from '../lib/profile'

export const FlamechartSearchContext = createContext<FlamechartSearchData | null>(null)

export interface FlamechartSearchProps {
  flamechart: Flamechart
  selectedNode: CallTreeNode | null
  setSelectedNode: (node: CallTreeNode | null) => void
  configSpaceViewportRect: Rect
  setConfigSpaceViewportRect: (rect: Rect) => void
  children: ComponentChildren
}

interface FlamechartSearchData {
  results: FlamechartSearchResults | null
  flamechart: Flamechart
  selectedNode: CallTreeNode | null
  setSelectedNode: (node: CallTreeNode | null) => void
  configSpaceViewportRect: Rect
  setConfigSpaceViewportRect: (rect: Rect) => void
}

export const FlamechartSearchContextProvider = ({
  flamechart,
  selectedNode,
  setSelectedNode,
  configSpaceViewportRect,
  setConfigSpaceViewportRect,
  children,
}: FlamechartSearchProps) => {
  const profileSearchResults: ProfileSearchResults | null = useContext(ProfileSearchContext)
  const flamechartSearchResults: FlamechartSearchResults | null = useMemo(() => {
    if (profileSearchResults == null) {
      return null
    }
    return new FlamechartSearchResults(flamechart, profileSearchResults)
  }, [flamechart, profileSearchResults])

  return (
    <FlamechartSearchContext.Provider
      value={{
        results: flamechartSearchResults,
        flamechart,
        selectedNode,
        setSelectedNode,
        configSpaceViewportRect,
        setConfigSpaceViewportRect,
      }}
    >
      {children}
    </FlamechartSearchContext.Provider>
  )
}

export const FlamechartSearchView = memo(() => {
  const flamechartData = useContext(FlamechartSearchContext)

  // TODO(jlfwong): This pattern is pretty gross, but I really don't want values
  // that can be undefined or null.
  const searchResults = flamechartData == null ? null : flamechartData.results
  const selectedNode = flamechartData == null ? null : flamechartData.selectedNode
  const setSelectedNode = flamechartData == null ? null : flamechartData.setSelectedNode
  const configSpaceViewportRect =
    flamechartData == null ? null : flamechartData.configSpaceViewportRect
  const setConfigSpaceViewportRect =
    flamechartData == null ? null : flamechartData.setConfigSpaceViewportRect
  const flamechart = flamechartData == null ? null : flamechartData.flamechart

  const numResults = searchResults == null ? null : searchResults.count()
  const resultIndex: number | null = useMemo(() => {
    if (searchResults == null) return null
    if (selectedNode == null) return null
    return searchResults.indexOf(selectedNode)
  }, [searchResults, selectedNode])

  const selectAndZoomToMatch = useCallback(
    (match: FlamechartSearchMatch) => {
      if (!setSelectedNode) return
      if (!flamechart) return
      if (!configSpaceViewportRect) return
      if (!setConfigSpaceViewportRect) return

      // After the node is selected, we want to set the viewport so that the new
      // node can be seen clearly.
      //
      // TODO(jlfwong): The lack of animation here can be kind of jarring. It
      // would be nice to have some easier way for people to orient themselves
      // after the viewport shifted.
      const configSpaceResultBounds = match.configSpaceBounds

      const viewportRect = new Rect(
        configSpaceResultBounds.origin.minus(new Vec2(0, 1)),
        configSpaceResultBounds.size.withY(configSpaceViewportRect.height()),
      )

      setSelectedNode(match.node)
      setConfigSpaceViewportRect(
        flamechart.getClampedConfigSpaceViewportRect({configSpaceViewportRect: viewportRect}),
      )
    },
    [configSpaceViewportRect, setConfigSpaceViewportRect, setSelectedNode, flamechart],
  )

  const matchToRestore = useAtom(searchMatchToRestoreAtom)

  useEffect(() => {
    if (matchToRestore == null) return
    if (searchResults == null || numResults == null || numResults === 0) return
    // Wait until the view has laid out its viewport, so that zooming to the
    // match produces a sensible rect
    if (configSpaceViewportRect == null || configSpaceViewportRect.isEmpty()) return

    searchMatchToRestoreAtom.set(null)
    selectAndZoomToMatch(searchResults.at(Math.min(matchToRestore, numResults) - 1))
  }, [matchToRestore, searchResults, numResults, configSpaceViewportRect, selectAndZoomToMatch])

  useEffect(() => {
    // Don't clobber the match= parameter before it has been restored
    if (matchToRestore != null) return
    saveSearchMatchToHash(resultIndex == null ? null : resultIndex + 1)
  }, [matchToRestore, resultIndex])

  const {selectPrev, selectNext} = useMemo(() => {
    if (numResults == null || numResults === 0 || searchResults == null) {
      return {selectPrev: () => {}, selectNext: () => {}}
    }

    return {
      selectPrev: () => {
        if (!searchResults?.at) return
        if (numResults == null || numResults === 0) return

        let index = resultIndex == null ? numResults - 1 : resultIndex - 1
        if (index < 0) index = numResults - 1
        const result = searchResults.at(index)
        selectAndZoomToMatch(result)
      },

      selectNext: () => {
        if (!searchResults?.at) return
        if (numResults == null || numResults === 0) return

        let index = resultIndex == null ? 0 : resultIndex + 1
        if (index >= numResults) index = 0
        const result = searchResults.at(index)
        selectAndZoomToMatch(result)
      },
    }
  }, [numResults, resultIndex, searchResults, selectAndZoomToMatch])

  return (
    <SearchView
      resultIndex={resultIndex}
      numResults={numResults}
      selectPrev={selectPrev}
      selectNext={selectNext}
    />
  )
})
