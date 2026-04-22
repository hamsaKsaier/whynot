import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Input } from "../input"

describe("Input", () => {
  it("renders without crashing", () => {
    render(<Input placeholder="test" />)
    expect(screen.getByPlaceholderText("test")).toBeInTheDocument()
  })

  it("has correct base classes", () => {
    render(<Input data-testid="input" />)
    const input = screen.getByTestId("input")
    expect(input).toHaveClass("rounded-md")
    expect(input).toHaveClass("border")
    expect(input).toHaveClass("border-input")
  })

  it("supports disabled state", () => {
    render(<Input disabled data-testid="input" />)
    expect(screen.getByTestId("input")).toBeDisabled()
  })

  it("forwards ref", () => {
    const ref = { current: null as HTMLInputElement | null }
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})
