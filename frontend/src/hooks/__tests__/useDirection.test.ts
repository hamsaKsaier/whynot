import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"

let mockResolvedLanguage = "en"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      get resolvedLanguage() {
        return mockResolvedLanguage
      },
    },
    t: (key: string) => key,
  }),
}))

vi.mock("@/i18n", () => ({
  RTL_LANGUAGES: ["ar"],
}))

import { useDirection } from "../useDirection"

describe("useDirection", () => {
  beforeEach(() => {
    mockResolvedLanguage = "en"
    document.documentElement.removeAttribute("dir")
    document.documentElement.removeAttribute("lang")
  })

  it("defaults to ltr when language is English", () => {
    const { result } = renderHook(() => useDirection())
    expect(result.current.direction).toBe("ltr")
    expect(result.current.isRtl).toBe(false)
  })

  it("returns rtl for Arabic language", () => {
    mockResolvedLanguage = "ar"
    const { result } = renderHook(() => useDirection())
    expect(result.current.direction).toBe("rtl")
    expect(result.current.isRtl).toBe(true)
  })

  it("returns ltr for English", () => {
    mockResolvedLanguage = "en"
    const { result } = renderHook(() => useDirection())
    expect(result.current.direction).toBe("ltr")
  })

  it("returns ltr for French", () => {
    mockResolvedLanguage = "fr"
    const { result } = renderHook(() => useDirection())
    expect(result.current.direction).toBe("ltr")
  })

  it("sets dir=rtl on document element for Arabic", () => {
    mockResolvedLanguage = "ar"
    renderHook(() => useDirection())
    expect(document.documentElement.getAttribute("dir")).toBe("rtl")
  })

  it("sets dir=ltr on document element for English", () => {
    mockResolvedLanguage = "en"
    renderHook(() => useDirection())
    expect(document.documentElement.getAttribute("dir")).toBe("ltr")
  })

  it("sets lang attribute on document element", () => {
    mockResolvedLanguage = "ar"
    renderHook(() => useDirection())
    expect(document.documentElement.getAttribute("lang")).toBe("ar")
  })

  it("setDirection updates direction manually", () => {
    const { result } = renderHook(() => useDirection())
    act(() => result.current.setDirection("rtl"))
    expect(result.current.direction).toBe("rtl")
    expect(document.documentElement.getAttribute("dir")).toBe("rtl")
  })

  it("language detector falls back to en for unsupported language", () => {
    mockResolvedLanguage = "en"
    const { result } = renderHook(() => useDirection())
    expect(result.current.direction).toBe("ltr")
  })
})
