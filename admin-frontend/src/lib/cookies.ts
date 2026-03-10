export function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null
    return null
}

export function setCookie(name: string, value: string, maxAgeSeconds?: number) {
    if (typeof document === 'undefined') return
    let cookieText = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/`
    if (maxAgeSeconds !== undefined) {
        cookieText += `; max-age=${maxAgeSeconds}`
    }
    document.cookie = cookieText
}

export function removeCookie(name: string) {
    if (typeof document === 'undefined') return
    document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`
}
