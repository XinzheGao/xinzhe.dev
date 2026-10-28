import { useEffect } from 'react'

export function useKeyPress(callback, keyCodes) {
  useEffect(() => {
    const handler = (event) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]'))
        return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (keyCodes.includes(event.code)) {
        callback(event)
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [callback, keyCodes])
}
