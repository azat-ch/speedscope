import {getHashParams, hashWithParam, hashWithViewMode} from './hash-params'
import {ViewMode} from './view-mode'

test('getHashParams', () => {
  expect(getHashParams('')).toEqual({})
  expect(getHashParams('#')).toEqual({})
  expect(getHashParams('#title=hello')).toEqual({title: 'hello'})
  expect(getHashParams('#localProfilePath=file:///tmp/file.js')).toEqual({
    localProfilePath: 'file:///tmp/file.js',
  })
  expect(
    getHashParams(
      '#profileURL=https://raw.githubusercontent.com/jlfwong/speedscope/main/sample/profiles/speedscope/0.1.2/simple-sampled.speedscope.json',
    ),
  ).toEqual({
    profileURL:
      'https://raw.githubusercontent.com/jlfwong/speedscope/main/sample/profiles/speedscope/0.1.2/simple-sampled.speedscope.json',
  })
  expect(getHashParams('#title=hello&localProfilePath=file:///tmp/file.js')).toEqual({
    title: 'hello',
    localProfilePath: 'file:///tmp/file.js',
  })
  expect(getHashParams('#title=hello%20world')).toEqual({
    title: 'hello world',
  })
  expect(getHashParams('#abc=bcd')).toEqual({})
  expect(getHashParams('garbage')).toEqual({})
  expect(getHashParams('#view=time-ordered')).toEqual({viewMode: ViewMode.CHRONO_FLAME_CHART})
  expect(getHashParams('#view=left-heavy')).toEqual({viewMode: ViewMode.LEFT_HEAVY_FLAME_GRAPH})
  expect(getHashParams('#view=sandwich')).toEqual({viewMode: ViewMode.SANDWICH_VIEW})
  expect(getHashParams('#view=garbage')).toEqual({})
  expect(getHashParams('#reverse=true')).toEqual({reverse: true})
  expect(getHashParams('#reverse=1')).toEqual({reverse: true})
  expect(getHashParams('#reverse=false')).toEqual({reverse: false})
  expect(getHashParams('#search=hello%20world')).toEqual({searchQuery: 'hello world'})
  // Encoded search queries containing hash-syntax characters must round-trip
  const query = 'a&b=c#d%e'
  expect(
    getHashParams(hashWithParam('#view=left-heavy', 'search', encodeURIComponent(query))),
  ).toEqual({
    viewMode: ViewMode.LEFT_HEAVY_FLAME_GRAPH,
    searchQuery: query,
  })
})

test('hashWithParam', () => {
  expect(hashWithParam('', 'reverse', 'true')).toEqual('#reverse=true')
  expect(hashWithParam('#view=left-heavy', 'reverse', 'true')).toEqual(
    '#view=left-heavy&reverse=true',
  )
  expect(hashWithParam('#view=left-heavy&reverse=true', 'reverse', null)).toEqual(
    '#view=left-heavy',
  )
  expect(hashWithParam('#reverse=true', 'reverse', null)).toEqual('#')
  expect(hashWithParam('#title=hello', 'reverse', null)).toEqual('#title=hello')
})

test('hashWithViewMode', () => {
  expect(hashWithViewMode('', ViewMode.LEFT_HEAVY_FLAME_GRAPH)).toEqual('#view=left-heavy')
  expect(hashWithViewMode('#', ViewMode.SANDWICH_VIEW)).toEqual('#view=sandwich')
  expect(hashWithViewMode('#view=left-heavy', ViewMode.CHRONO_FLAME_CHART)).toEqual(
    '#view=time-ordered',
  )
  expect(hashWithViewMode('#title=hello&view=sandwich', ViewMode.LEFT_HEAVY_FLAME_GRAPH)).toEqual(
    '#title=hello&view=left-heavy',
  )
  // Components which are not strictly URI-encoded must survive untouched
  expect(
    hashWithViewMode(
      '#profileURL=https://pastila.nl/?00000000/abcdef.json%23keyGCM&title=hello',
      ViewMode.SANDWICH_VIEW,
    ),
  ).toEqual(
    '#profileURL=https://pastila.nl/?00000000/abcdef.json%23keyGCM&title=hello&view=sandwich',
  )
  // Round-trip: parsing the updated hash yields the requested view mode
  expect(getHashParams(hashWithViewMode('#title=hello', ViewMode.SANDWICH_VIEW))).toEqual({
    title: 'hello',
    viewMode: ViewMode.SANDWICH_VIEW,
  })
})
