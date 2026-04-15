import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "../button"

describe("Button", () => {
  it("renders without crashing", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("applies default variant classes", () => {
    render(<Button>Default</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("bg-primary")
    expect(button).toHaveClass("text-primary-foreground")
  })

  it("applies destructive variant", () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("bg-destructive")
  })

  it("applies outline variant", () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole("button")
    expect(button).toHaveClass("border")
    expect(button).toHaveClass("border-input")
  })

  it("applies size classes", () => {
    render(<Button size="sm">Small</Button>)
    expect(screen.getByRole("button")).toHaveClass("h-9")
  })

  it("forwards ref", () => {
    const ref = { current: null as HTMLButtonElement | null }
    render(<Button ref={ref}>Ref</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it("passes additional className", () => {
    render(<Button className="custom-class">Custom</Button>)
    expect(screen.getByRole("button")).toHaveClass("custom-class")
  })

  it("supports disabled state", () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole("button")).toBeDisabled()
  })
})
