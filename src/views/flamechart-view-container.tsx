import {h} from 'preact'
import {CanvasContext} from '../gl/canvas-context'
import {Flamechart, FlamechartFrame} from '../lib/flamechart'
import {FlamechartRenderer, FlamechartRendererOptions} from '../gl/flamechart-renderer'
import {Frame, Profile, CallTreeNode, getCallTreeNodeAtIndexPath} from '../lib/profile'
import {memoizeByReference, memoizeByShallowEquality} from '../lib/utils'
import {FlamechartView} from './flamechart-view'
import {
  getRowAtlas,
  createGetColorBucketForFrame,
  getCanvasContext,
  createGetCSSColorForFrame,
  getFrameToColorBucket,
} from '../app-state/getters'
import {Vec2, Rect} from '../lib/math'
import {memo, useCallback, useEffect} from 'preact/compat'
import {ActiveProfileState} from '../app-state/active-profile-state'
import {FlamechartSearchContextProvider} from './flamechart-search-view'
import {Theme, useTheme} from './themes/theme'
import {FlamechartID, FlamechartViewState} from '../app-state/profile-group'
import {profileGroupAtom, reverseFlamegraphAtom, selectedToRestoreAtom} from '../app-state'
import {useAtom} from '../lib/atom'

interface FlamechartSetters {
  setLogicalSpaceViewportSize: (logicalSpaceViewportSize: Vec2) => void
  setConfigSpaceViewportRect: (configSpaceViewportRect: Rect) => void
  setNodeHover: (hover: {node: CallTreeNode; event: MouseEvent} | null) => void
  setSelectedNode: (node: CallTreeNode | null) => void
}

export function useFlamechartSetters(id: FlamechartID): FlamechartSetters {
  return {
    setNodeHover: useCallback(
      (hover: {node: CallTreeNode; event: MouseEvent} | null) => {
        profileGroupAtom.setFlamechartHoveredNode(id, hover)
      },
      [id],
    ),
    setLogicalSpaceViewportSize: useCallback(
      (logicalSpaceViewportSize: Vec2) => {
        profileGroupAtom.setLogicalSpaceViewportSize(id, logicalSpaceViewportSize)
      },
      [id],
    ),
    setConfigSpaceViewportRect: useCallback(
      (configSpaceViewportRect: Rect) => {
        profileGroupAtom.setConfigSpaceViewportRect(id, configSpaceViewportRect)
      },
      [id],
    ),
    setSelectedNode: useCallback(
      (selectedNode: CallTreeNode | null) => {
        profileGroupAtom.setSelectedNode(id, selectedNode)
      },
      [id],
    ),
  }
}

function getConfigSpaceBoundsForNode(flamechart: Flamechart, node: CallTreeNode): Rect | null {
  let found: Rect | null = null
  function visit(frame: FlamechartFrame, depth: number): boolean {
    if (frame.node === node) {
      found = new Rect(new Vec2(frame.start, depth), new Vec2(frame.end - frame.start, 1))
      return true
    }
    return frame.children.some(child => visit(child, depth + 1))
  }
  const layers = flamechart.getLayers()
  if (layers.length > 0) {
    layers[0].some(frame => visit(frame, 0))
  }
  return found
}

// Restores the selection shared via the selected= URL parameter (a calltree
// index path) once: selects the node and zooms to it, mirroring what
// selecting a search match does
function useRestoreSelectedNode(
  root: CallTreeNode,
  flamechart: Flamechart,
  viewState: FlamechartViewState,
  setters: FlamechartSetters,
) {
  const selectedToRestore = useAtom(selectedToRestoreAtom)
  const {setSelectedNode, setConfigSpaceViewportRect} = setters
  const {configSpaceViewportRect} = viewState

  useEffect(() => {
    if (selectedToRestore == null) return
    // Wait until the view has laid out its viewport, so that zooming to the
    // node produces a sensible rect
    if (configSpaceViewportRect.isEmpty()) return
    selectedToRestoreAtom.set(null)

    const path = selectedToRestore.split('.').map(part => parseInt(part, 10))
    if (path.some(isNaN)) return
    const node = getCallTreeNodeAtIndexPath(root, path)
    if (node == null) return

    setSelectedNode(node)
    const bounds = getConfigSpaceBoundsForNode(flamechart, node)
    if (bounds != null) {
      const viewportRect = new Rect(
        bounds.origin.minus(new Vec2(0, 1)),
        bounds.size.withY(configSpaceViewportRect.height()),
      )
      setConfigSpaceViewportRect(
        flamechart.getClampedConfigSpaceViewportRect({configSpaceViewportRect: viewportRect}),
      )
    }
  }, [
    selectedToRestore,
    root,
    flamechart,
    configSpaceViewportRect,
    setSelectedNode,
    setConfigSpaceViewportRect,
  ])
}

export type FlamechartViewProps = {
  theme: Theme
  canvasContext: CanvasContext
  flamechart: Flamechart
  flamechartRenderer: FlamechartRenderer
  renderInverted: boolean
  getCSSColorForFrame: (frame: Frame) => string
} & FlamechartSetters &
  FlamechartViewState

export const getChronoViewFlamechart = memoizeByShallowEquality(
  ({
    profile,
    getColorBucketForFrame,
  }: {
    profile: Profile
    getColorBucketForFrame: (frame: Frame) => number
  }): Flamechart => {
    return new Flamechart({
      getTotalWeight: profile.getTotalWeight.bind(profile),
      forEachCall: profile.forEachCall.bind(profile),
      formatValue: profile.formatValue.bind(profile),
      getColorBucketForFrame,
    })
  },
)

export const createMemoizedFlamechartRenderer = (options?: FlamechartRendererOptions) =>
  memoizeByShallowEquality(
    ({
      canvasContext,
      flamechart,
    }: {
      canvasContext: CanvasContext
      flamechart: Flamechart
    }): FlamechartRenderer => {
      return new FlamechartRenderer(
        canvasContext.gl,
        getRowAtlas(canvasContext),
        flamechart,
        canvasContext.rectangleBatchRenderer,
        canvasContext.flamechartColorPassRenderer,
        options,
      )
    },
  )

const getChronoViewFlamechartRenderer = createMemoizedFlamechartRenderer()

export interface FlamechartViewContainerProps {
  activeProfileState: ActiveProfileState
  glCanvas: HTMLCanvasElement
}

export const ChronoFlamechartView = memo((props: FlamechartViewContainerProps) => {
  const {activeProfileState, glCanvas} = props
  const {profile, chronoViewState} = activeProfileState

  const theme = useTheme()

  const canvasContext = getCanvasContext({theme, canvas: glCanvas})
  const frameToColorBucket = getFrameToColorBucket(profile)
  const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket)
  const getCSSColorForFrame = createGetCSSColorForFrame({theme, frameToColorBucket})

  const flamechart = getChronoViewFlamechart({profile, getColorBucketForFrame})
  const flamechartRenderer = getChronoViewFlamechartRenderer({
    canvasContext,
    flamechart,
  })

  const setters = useFlamechartSetters(FlamechartID.CHRONO)

  useRestoreSelectedNode(profile.getAppendOrderCalltreeRoot(), flamechart, chronoViewState, setters)

  return (
    <FlamechartSearchContextProvider
      flamechart={flamechart}
      selectedNode={chronoViewState.selectedNode}
      setSelectedNode={setters.setSelectedNode}
      configSpaceViewportRect={chronoViewState.configSpaceViewportRect}
      setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
    >
      <FlamechartView
        theme={theme}
        renderInverted={false}
        flamechart={flamechart}
        flamechartRenderer={flamechartRenderer}
        canvasContext={canvasContext}
        getCSSColorForFrame={getCSSColorForFrame}
        {...chronoViewState}
        {...setters}
      />
    </FlamechartSearchContextProvider>
  )
})

export const getLeftHeavyFlamechart = memoizeByShallowEquality(
  ({
    profile,
    getColorBucketForFrame,
  }: {
    profile: Profile
    getColorBucketForFrame: (frame: Frame) => number
  }): Flamechart => {
    return new Flamechart({
      getTotalWeight: profile.getTotalNonIdleWeight.bind(profile),
      forEachCall: profile.forEachCallGrouped.bind(profile),
      formatValue: profile.formatValue.bind(profile),
      getColorBucketForFrame,
    })
  },
)

const getLeftHeavyFlamechartRenderer = createMemoizedFlamechartRenderer()

const getInvertedProfile = memoizeByReference((profile: Profile) => profile.getInvertedProfile())

export const LeftHeavyFlamechartView = memo((ownProps: FlamechartViewContainerProps) => {
  const {activeProfileState, glCanvas} = ownProps

  const {profile, leftHeavyViewState} = activeProfileState
  const reverseFlamegraph = useAtom(reverseFlamegraphAtom)

  const theme = useTheme()

  const canvasContext = getCanvasContext({theme, canvas: glCanvas})
  const frameToColorBucket = getFrameToColorBucket(profile)
  const getColorBucketForFrame = createGetColorBucketForFrame(frameToColorBucket)
  const getCSSColorForFrame = createGetCSSColorForFrame({theme, frameToColorBucket})

  const leftHeavyProfile = reverseFlamegraph ? getInvertedProfile(profile) : profile
  const flamechart = getLeftHeavyFlamechart({
    profile: leftHeavyProfile,
    getColorBucketForFrame,
  })
  const flamechartRenderer = getLeftHeavyFlamechartRenderer({
    canvasContext,
    flamechart,
  })

  const setters = useFlamechartSetters(FlamechartID.LEFT_HEAVY)

  useRestoreSelectedNode(
    leftHeavyProfile.getGroupedCalltreeRoot(),
    flamechart,
    leftHeavyViewState,
    setters,
  )

  return (
    <FlamechartSearchContextProvider
      flamechart={flamechart}
      selectedNode={leftHeavyViewState.selectedNode}
      setSelectedNode={setters.setSelectedNode}
      configSpaceViewportRect={leftHeavyViewState.configSpaceViewportRect}
      setConfigSpaceViewportRect={setters.setConfigSpaceViewportRect}
    >
      <FlamechartView
        theme={theme}
        renderInverted={false}
        flamechart={flamechart}
        flamechartRenderer={flamechartRenderer}
        canvasContext={canvasContext}
        getCSSColorForFrame={getCSSColorForFrame}
        {...leftHeavyViewState}
        {...setters}
      />
    </FlamechartSearchContextProvider>
  )
})
