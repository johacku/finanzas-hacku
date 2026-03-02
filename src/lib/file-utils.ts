/**
 * Client-side file utilities
 * These functions use browser APIs and must NOT be in "use server" files
 */

/**
 * Convert File to Base64 string
 * This uses FileReader which is a browser API
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = reject
  })
}

/**
 * Convert File to base64 string (data URL format)
 * Same as fileToBase64, alternative name
 */
export async function fileToDataUrl(file: File): Promise<string> {
  return fileToBase64(file)
}
