import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import React from "react"

let flagValue = true
vi.mock("@/hooks/useFeatureFlag", () => ({
  useFeatureFlag: () => flagValue,
}))

import { ReconAnnouncementBanner } from "../ReconAnnouncementBanner"

const DISMISS_KEY = "recon.announcement.dismissed"
const SEEN_KEY = "recon.announcement.seen"
const DAY_MS = 24 * 60 * 60 * 1000

function renderBanner() {
  return render(
    <MemoryRouter>
      <ReconAnnouncementBanner />
    </MemoryRouter>
  )
}

describe("ReconAnnouncementBanner", () => {
  beforeEach(() => {
    flagValue = true
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-24T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders when flag is enabled, no dismiss, and user has not seen /recon", () => {
    renderBanner()
    expect(screen.getByTestId("recon-announcement-banner")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /try recon/i })).toHaveAttribute("href", "/recon")
  })

  it("is hidden when recon_enabled flag is false", () => {
    flagValue = false
    renderBanner()
    expect(screen.queryByTestId("recon-announcement-banner")).not.toBeInTheDocument()
  })

  it("is hidden when dismissed less than 30 days ago", () => {
    const fiveDaysAgo = Date.now() - 5 * DAY_MS
    localStorage.setItem(DISMISS_KEY, String(fiveDaysAgo))
    renderBanner()
    expect(screen.queryByTestId("recon-announcement-banner")).not.toBeInTheDocument()
  })

  it("re-appears 30 days after dismissal", () => {
    const thirtyOneDaysAgo = Date.now() - 31 * DAY_MS
    localStorage.setItem(DISMISS_KEY, String(thirtyOneDaysAgo))
    renderBanner()
    expect(screen.getByTestId("recon-announcement-banner")).toBeInTheDocument()
  })

  it("is hidden when user has already visited /recon", () => {
    localStorage.setItem(SEEN_KEY, "1")
    renderBanner()
    expect(screen.queryByTestId("recon-announcement-banner")).not.toBeInTheDocument()
  })

  it("dismiss writes the current timestamp to localStorage and hides the banner", () => {
    renderBanner()
    const dismissBtn = screen.getByRole("button", { name: /dismiss/i })

    act(() => {
      fireEvent.click(dismissBtn)
    })

    const stored = localStorage.getItem(DISMISS_KEY)
    expect(stored).not.toBeNull()
    expect(Number.parseInt(stored!, 10)).toBe(Date.now())

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.queryByTestId("recon-announcement-banner")).not.toBeInTheDocument()
  })

  it("ignores a malformed dismiss timestamp and renders", () => {
    localStorage.setItem(DISMISS_KEY, "not-a-number")
    renderBanner()
    expect(screen.getByTestId("recon-announcement-banner")).toBeInTheDocument()
  })

  it("renders headline, subheadline, CTA and dismiss copy", () => {
    renderBanner()
    expect(screen.getByText("Recon is here.")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Run an autonomous pentest against your app — only proven exploits are reported."
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Try Recon" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument()
  })

  it("snapshot (en)", () => {
    const { container } = renderBanner()
    expect(container.firstChild).toMatchSnapshot()
  })

  it("snapshot (ar) — rendered HTML contains no banned vocabulary", async () => {
    const i18next = (await import("i18next")).default
    const prev = i18next.language
    await act(async () => {
      await i18next.changeLanguage("ar")
    })
    try {
      const { container } = renderBanner()
      expect(container.firstChild).toMatchSnapshot()

      const html = container.innerHTML.toLowerCase()
      const banned = [
        "shannon",
        "keygraphhq",
        "nmap",
        "subfinder",
        "whatweb",
        "schemathesis",
        "playwright",
        "anthropic",
        "claude",
      ]
      for (const word of banned) {
        expect(html).not.toContain(word)
      }
    } finally {
      await act(async () => {
        await i18next.changeLanguage(prev)
      })
    }
  })

  it("rendered HTML (en) contains no banned vocabulary", () => {
    const { container } = renderBanner()
    const html = container.innerHTML.toLowerCase()
    const banned = [
      "shannon",
      "keygraphhq",
      "nmap",
      "subfinder",
      "whatweb",
      "schemathesis",
      "playwright",
      "anthropic",
      "claude",
    ]
    for (const word of banned) {
      expect(html).not.toContain(word)
    }
  })
})
