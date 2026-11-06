import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react"

export type Theme = "light" | "dark" | "system"
type ResolvedTheme = Exclude<Theme, "system">

const STORAGE_KEY = "cover-studio-theme"
const SYSTEM_QUERY = "(prefers-color-scheme: dark)"

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return isTheme(saved) ? saved : "system"
  } catch {
    return "system"
  }
}

function readSystemTheme(): ResolvedTheme {
  return typeof window !== "undefined" && window.matchMedia(SYSTEM_QUERY).matches
    ? "dark"
    : "light"
}

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(readTheme)
  const [systemTheme, updateSystemTheme] = useState<ResolvedTheme>(readSystemTheme)
  const resolvedTheme = theme === "system" ? systemTheme : theme

  const setTheme = useCallback((nextTheme: Theme) => {
    if (nextTheme === "system") updateSystemTheme(readSystemTheme())
    updateTheme(nextTheme)
    try {
      window.localStorage.setItem(STORAGE_KEY, nextTheme)
    } catch {
      // The selected theme still works when browser storage is unavailable.
    }
  }, [])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
    root.dataset.theme = resolvedTheme
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    if (theme !== "system") return
    const query = window.matchMedia(SYSTEM_QUERY)
    const syncSystemTheme = () => updateSystemTheme(query.matches ? "dark" : "light")
    syncSystemTheme()
    query.addEventListener("change", syncSystemTheme)
    return () => query.removeEventListener("change", syncSystemTheme)
  }, [theme])

  useEffect(() => {
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return
      if (event.newValue === null || isTheme(event.newValue)) {
        updateSystemTheme(readSystemTheme())
        updateTheme(event.newValue ?? "system")
      }
    }
    window.addEventListener("storage", syncStoredTheme)
    return () => window.removeEventListener("storage", syncStoredTheme)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
