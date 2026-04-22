import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../card"

describe("Card", () => {
  it("renders without crashing", () => {
    render(<Card data-testid="card">Content</Card>)
    expect(screen.getByTestId("card")).toBeInTheDocument()
  })

  it("has correct base classes", () => {
    render(<Card data-testid="card">Content</Card>)
    const card = screen.getByTestId("card")
    expect(card).toHaveClass("rounded-lg")
    expect(card).toHaveClass("border")
    expect(card).toHaveClass("bg-card")
    expect(card).toHaveClass("shadow-sm")
  })

  it("renders full card structure", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    )
    expect(screen.getByText("Title")).toBeInTheDocument()
    expect(screen.getByText("Description")).toBeInTheDocument()
    expect(screen.getByText("Body")).toBeInTheDocument()
  })
})
