import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Logo } from "../Logo"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "common.logoAlt") return "WhyNot — AI QA platform"
      return key
    },
  }),
}))

const mockUseThemeContext = vi.fn(() => ({
  theme: "light" as "light" | "dark" | "system",
  resolvedTheme: "light" as "light" | "dark",
  setTheme: vi.fn() as (theme: "light" | "dark" | "system") => void,
  toggle: vi.fn(),
}))

vi.mock("../../ThemeProvider", () => ({
  useThemeContext: () => mockUseThemeContext(),
}))

describe("Logo", () => {
  it("renders without crashing", () => {
    render(<Logo />)
    expect(screen.getByRole("img")).toBeInTheDocument()
  })

  it("renders light variant in light mode", () => {
    mockUseThemeContext.mockReturnValue({
      theme: "light",
      resolvedTheme: "light",
      setTheme: vi.fn(),
      toggle: vi.fn(),
    })
    render(<Logo />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("src", "/logo-light.svg")
  })

  it("renders dark variant in dark mode", () => {
    mockUseThemeContext.mockReturnValue({
      theme: "dark" as const,
      resolvedTheme: "dark" as const,
      setTheme: vi.fn(),
      toggle: vi.fn(),
    })
    render(<Logo />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("src", "/logo-dark.svg")
  })

  it("has accessible alt text", () => {
    render(<Logo />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("alt", "WhyNot — AI QA platform")
    expect(img).toHaveAttribute("aria-label", "WhyNot — AI QA platform")
  })

  it("applies sm size class", () => {
    render(<Logo size="sm" />)
    const img = screen.getByRole("img")
    expect(img).toHaveClass("h-6")
  })

  it("applies md size class by default", () => {
    render(<Logo />)
    const img = screen.getByRole("img")
    expect(img).toHaveClass("h-8")
  })

  it("applies lg size class", () => {
    render(<Logo size="lg" />)
    const img = screen.getByRole("img")
    expect(img).toHaveClass("h-10")
  })

  it("renders mark variant with favicon", () => {
    render(<Logo variant="mark" />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("src", "/favicon.svg")
  })

  it("merges custom className", () => {
    render(<Logo className="extra-class" />)
    const img = screen.getByRole("img")
    expect(img).toHaveClass("extra-class")
  })

  it("always includes w-auto class", () => {
    render(<Logo />)
    const img = screen.getByRole("img")
    expect(img).toHaveClass("w-auto")
  })
})
