import {decryptAES128GCM} from '../lib/crypto-utils'
import {decodeBase64} from '../lib/utils'

const CLICKHOUSE_API = 'https://uzg8q0g12h.eu-central-1.aws.clickhouse.cloud/?user=paste'

interface PastilaUrlParts {
  fingerprint: string
  hash: string
  extension?: string
  encryptionKey?: string
}

interface PastilaResponse {
  content: string
  is_encrypted: boolean
  prev_hash?: string
  prev_fingerprint?: string
}

/**
 * Checks if a URL is a pastila.nl URL
 */
export function isPastilaUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname === 'pastila.nl' || urlObj.hostname.endsWith('.pastila.nl')
  } catch {
    return false
  }
}

/**
 * Parses a pastila.nl URL into its components
 *
 * URL format: https://pastila.nl/?{fingerprint}/{hash}{.extension}#{key}GCM
 * - fingerprint: 8 hex characters
 * - hash: 32 hex characters
 * - extension: optional (e.g., .json, .txt)
 * - key: base64-encoded encryption key (optional, present if encrypted)
 */
export function parsePastilaUrl(url: string): PastilaUrlParts | null {
  try {
    const urlObj = new URL(url)

    const match = urlObj.search.match(/^\?([0-9a-f]{8})\/([0-9a-f]{32})(\..*)?$/)
    if (!match) {
      return null
    }

    const fingerprint = match[1]
    const hash = match[2]
    const extension = match[3]

    let encryptionKey: string | undefined
    if (urlObj.hash) {
      let hashParams = urlObj.hash.substring(1)
      hashParams = hashParams.replace(/&.*$/, '')
      if (hashParams.endsWith('GCM')) {
        encryptionKey = hashParams.slice(0, -3)
      }
    }

    return {
      fingerprint,
      hash,
      extension,
      encryptionKey,
    }
  } catch (e) {
    console.error('Failed to parse pastila.nl URL:', e)
    return null
  }
}

/**
 * Fetches content from pastila.nl via ClickHouse API
 */
async function fetchPastilaContent(fingerprint: string, hash: string): Promise<PastilaResponse> {
  const query = `SELECT content, is_encrypted, lower(hex(reinterpretAsFixedString(prev_hash))) AS prev_hash, lower(hex(reinterpretAsFixedString(prev_fingerprint))) AS prev_fingerprint FROM data_view(fingerprint = '${fingerprint}', hash = '${hash}') FORMAT JSON`

  const response = await fetch(CLICKHOUSE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: query,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch from pastila.nl: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()

  if (result.rows !== 1 || !result.data || result.data.length === 0) {
    throw new Error('Profile not found on pastila.nl')
  }

  const row = result.data[0]
  return {
    content: row.content,
    is_encrypted: row.is_encrypted === 1 || row.is_encrypted === true,
    prev_hash: row.prev_hash,
    prev_fingerprint: row.prev_fingerprint,
  }
}

/**
 * Loads and optionally decrypts content from a pastila.nl URL
 *
 * @param url - Full pastila.nl URL
 * @returns Promise<ArrayBuffer> - Decrypted/raw content ready for import
 */
export async function loadFromPastilaUrl(url: string): Promise<ArrayBuffer> {
  const parts = parsePastilaUrl(url)

  if (!parts) {
    throw new Error('Invalid pastila.nl URL format')
  }

  console.log('Loading from pastila.nl:', parts.fingerprint, parts.hash)

  const data = await fetchPastilaContent(parts.fingerprint, parts.hash)

  if (data.is_encrypted) {
    if (!parts.encryptionKey) {
      throw new Error(
        'This pastila.nl link contains encrypted content but no encryption key was provided in the URL',
      )
    }

    console.log('Decrypting content with AES-128-GCM')
    const decrypted = await decryptAES128GCM(data.content, parts.encryptionKey)
    return decrypted
  }

  console.log('Content is not encrypted, decoding base64')
  const decoded = decodeBase64(data.content)
  return decoded.buffer as ArrayBuffer
}

/**
 * Extracts a filename from pastila URL parts
 */
export function getPastilaFilename(url: string): string {
  const parts = parsePastilaUrl(url)
  if (!parts) return 'pastila-profile.json'

  const baseName = `pastila-${parts.fingerprint}-${parts.hash.slice(0, 8)}`
  return parts.extension ? `${baseName}${parts.extension}` : `${baseName}.json`
}
