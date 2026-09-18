import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'pog:theme'
const listeners = new Set<() => void>()

// Dark by default; clicking the flame remembers a different choice.
let theme: Theme = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
})()

function apply() {
  document.documentElement.dataset.theme = theme
  // The mark in the tab follows too: the lighter blue reads on a dark browser chrome.
  const suffix = theme === 'dark' ? '-dark' : ''
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', `/favicon${suffix}.png`)
  document
    .querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
    ?.setAttribute('href', `/apple-touch-icon${suffix}.png`)
}

// Applied as soon as this module loads, before the first render, so the page never flashes.
apply()

function toggle() {
  theme = theme === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Remembering the choice is only a convenience.
  }
  apply()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme() {
  return [useSyncExternalStore(subscribe, () => theme), toggle] as const
}
