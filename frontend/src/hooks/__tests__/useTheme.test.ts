import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTheme } from "../useTheme"

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("light", "dark")
  })

  it("defaults to system theme when no stored value", () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("system")
  })

  it("reads stored theme from localStorage", () => {
    localStorage.setItem("theme", "dark")
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe("dark")
  })

  it("persists theme to localStorage on change", () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme("dark"))
    expect(localStorage.getItem("theme")).toBe("dark")
  })

  it("adds dark class to documentElement when dark", () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme("dark"))
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.classList.contains("light")).toBe(false)
  })

  it("adds light class to documentElement when light", () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme("light"))
    expect(document.documentElement.classList.contains("light")).toBe(true)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("toggle switches between light and dark", () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme("light"))
    act(() => result.current.toggle())
    expect(result.current.theme).toBe("dark")
    act(() => result.current.toggle())
    expect(result.current.theme).toBe("light")
  })

  it("resolvedTheme returns actual theme when set to system", () => {
    const { result } = renderHook(() => useTheme())
    expect(["light", "dark"]).toContain(result.current.resolvedTheme)
  })
})
