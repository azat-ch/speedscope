import {exactMatchStrings, ProfileSearchResults} from './profile-search'
import {Frame, StackListProfileBuilder} from './profile'

function assertMatch(text: string, pattern: string, expected: string) {
  const match = exactMatchStrings(text, pattern)

  let highlighted = ''
  let last = 0
  for (let range of match) {
    highlighted += `${text.slice(last, range[0])}[${text.slice(range[0], range[1])}]`
    last = range[1]
  }
  highlighted += text.slice(last)

  expect(highlighted).toEqual(expected)
}

function assertNoMatch(text: string, pattern: string) {
  assertMatch(text, pattern, text)
}

describe('exactMatchStrings', () => {
  test('no match', () => {
    assertNoMatch('a', 'b')
    assertNoMatch('aa', 'ab')
    assertNoMatch('a', 'aa')
    assertNoMatch('ca', 'ac')
  })

  test('full text match', () => {
    assertMatch('hello', 'hello', '[hello]')
    assertMatch('multiple words', 'multiple words', '[multiple words]')
  })

  test('case sensitivity', () => {
    assertMatch('HELLO', 'hello', '[HELLO]')
    assertMatch('Hello', 'hello', '[Hello]')
    assertMatch('hello', 'Hello', '[hello]')
    assertMatch('hello', 'HELLO', '[hello]')
  })

  test('multiple occurrences', () => {
    assertMatch('hello hello', 'hello', '[hello] [hello]')
    assertMatch('hellohello', 'hello', '[hello][hello]')
  })

  test('overlapping occurrences', () => {
    assertMatch('aaaaa', 'aa', '[aa][aa]a')
    assertMatch('abababa', 'aba', '[aba]b[aba]')
  })
})

describe('ProfileSearchResults', () => {
  test('matches frames of derived profiles', () => {
    const b = new StackListProfileBuilder()
    b.appendSampleWithWeight(
      [
        {key: 'alpha', name: 'alpha'},
        {key: 'beta', name: 'beta'},
      ],
      1,
    )
    const profile = b.build()

    const results = new ProfileSearchResults(profile, 'beta')

    const framesByName = (p: typeof profile) => {
      const map = new Map<string | number, Frame>()
      p.forEachFrame(f => map.set(f.name, f))
      return map
    }

    expect(results.getMatchForFrame(framesByName(profile).get('beta')!)).toEqual([[0, 4]])
    expect(results.getMatchForFrame(framesByName(profile).get('alpha')!)).toBeNull()

    // Frames of a profile derived from the searched one are distinct
    // instances with the same keys, and must still match
    const inverted = profile.getInvertedProfile()
    const invertedBeta = framesByName(inverted).get('beta')!
    expect(invertedBeta).not.toBe(framesByName(profile).get('beta')!)
    expect(results.getMatchForFrame(invertedBeta)).toEqual([[0, 4]])
    expect(results.getMatchForFrame(framesByName(inverted).get('alpha')!)).toBeNull()
  })
})
