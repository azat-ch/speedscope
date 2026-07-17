import {isPastilaUrl, parsePastilaUrl, getPastilaFilename} from './pastila'

describe('pastila.nl support', () => {
  describe('isPastilaUrl', () => {
    test('detects pastila.nl URLs', () => {
      expect(isPastilaUrl('https://pastila.nl/?abc12345/def67890123456789012345678901234')).toBe(
        true,
      )
      expect(
        isPastilaUrl('https://pastila.nl/?abc12345/def67890123456789012345678901234.json'),
      ).toBe(true)
      expect(
        isPastilaUrl('https://pastila.nl/?abc12345/def67890123456789012345678901234#keyBase64GCM'),
      ).toBe(true)
    })

    test('detects pastila.nl subdomains', () => {
      expect(
        isPastilaUrl('https://www.pastila.nl/?abc12345/def67890123456789012345678901234'),
      ).toBe(true)
      expect(
        isPastilaUrl('https://sub.pastila.nl/?abc12345/def67890123456789012345678901234'),
      ).toBe(true)
    })

    test('rejects non-pastila URLs', () => {
      expect(isPastilaUrl('https://example.com')).toBe(false)
      expect(isPastilaUrl('https://pastila.com')).toBe(false)
      expect(isPastilaUrl('https://notpastila.nl')).toBe(false)
    })

    test('handles invalid URLs', () => {
      expect(isPastilaUrl('not a url')).toBe(false)
      expect(isPastilaUrl('')).toBe(false)
    })
  })

  describe('parsePastilaUrl', () => {
    test('parses URL with extension and encryption key', () => {
      const url = 'https://pastila.nl/?abc12345/def67890123456789012345678901234.json#keyBase64GCM'
      const parsed = parsePastilaUrl(url)

      expect(parsed).toEqual({
        fingerprint: 'abc12345',
        hash: 'def67890123456789012345678901234',
        extension: '.json',
        encryptionKey: 'keyBase64',
      })
    })

    test('parses URL without extension', () => {
      const url = 'https://pastila.nl/?abc12345/def67890123456789012345678901234#keyGCM'
      const parsed = parsePastilaUrl(url)

      expect(parsed).toEqual({
        fingerprint: 'abc12345',
        hash: 'def67890123456789012345678901234',
        extension: undefined,
        encryptionKey: 'key',
      })
    })

    test('parses URL without encryption', () => {
      const url = 'https://pastila.nl/?abc12345/def67890123456789012345678901234.json'
      const parsed = parsePastilaUrl(url)

      expect(parsed).toEqual({
        fingerprint: 'abc12345',
        hash: 'def67890123456789012345678901234',
        extension: '.json',
        encryptionKey: undefined,
      })
    })

    test('handles encryption key with & separator', () => {
      const url =
        'https://pastila.nl/?abc12345/def67890123456789012345678901234#keyBase64GCM&otherparam=value'
      const parsed = parsePastilaUrl(url)

      expect(parsed?.encryptionKey).toBe('keyBase64')
    })

    test('rejects invalid URL formats', () => {
      expect(parsePastilaUrl('https://pastila.nl/?short/tooshort')).toBeNull()
      expect(
        parsePastilaUrl('https://pastila.nl/?toolong123/def67890123456789012345678901234'),
      ).toBeNull()
      expect(parsePastilaUrl('https://pastila.nl/?abc12345/notahexhash')).toBeNull()
    })

    test('handles invalid URLs', () => {
      expect(parsePastilaUrl('not a url')).toBeNull()
    })
  })

  describe('getPastilaFilename', () => {
    test('generates filename with extension', () => {
      const url = 'https://pastila.nl/?abc12345/def67890123456789012345678901234.json#key'
      const filename = getPastilaFilename(url)

      expect(filename).toBe('pastila-abc12345-def67890.json')
    })

    test('generates filename without extension', () => {
      const url = 'https://pastila.nl/?abc12345/def67890123456789012345678901234'
      const filename = getPastilaFilename(url)

      expect(filename).toBe('pastila-abc12345-def67890.json')
    })

    test('handles invalid URL', () => {
      const filename = getPastilaFilename('not a url')

      expect(filename).toBe('pastila-profile.json')
    })
  })
})
