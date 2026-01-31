import {decodeBase64} from './utils'

/**
 * Decrypts data using AES-128-GCM with Web Crypto API
 *
 * This follows the pastila.nl encryption scheme:
 * - 16-byte key
 * - First 12 bytes of key used as IV
 * - AES-GCM authenticated encryption
 *
 * @param ciphertextBase64 - Base64-encoded ciphertext
 * @param keyBase64 - Base64-encoded 16-byte key
 * @returns Promise<ArrayBuffer> - Decrypted data
 */
export async function decryptAES128GCM(
  ciphertextBase64: string,
  keyBase64: string,
): Promise<ArrayBuffer> {
  const ciphertextBytes = decodeBase64(ciphertextBase64)
  const keyBytes = decodeBase64(keyBase64)

  if (keyBytes.length !== 16) {
    throw new Error(`AES-128 requires 16-byte key, got ${keyBytes.length} bytes`)
  }

  const iv = keyBytes.slice(0, 12)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    {name: 'AES-GCM', length: 128},
    false,
    ['decrypt'],
  )

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    cryptoKey,
    ciphertextBytes,
  )

  return decrypted
}
