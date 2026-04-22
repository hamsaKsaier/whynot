import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs"

describe("Tabs", () => {
  it("renders without crashing", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    )
    expect(screen.getByText("Tab 1")).toBeInTheDocument()
    expect(screen.getByText("Tab 2")).toBeInTheDocument()
    expect(screen.getByText("Content 1")).toBeInTheDocument()
  })

  it("TabsList has correct classes", () => {
    render(
      <Tabs defaultValue="t1">
        <TabsList data-testid="list">
          <TabsTrigger value="t1">T</TabsTrigger>
        </TabsList>
        <TabsContent value="t1">C</TabsContent>
      </Tabs>
    )
    expect(screen.getByTestId("list")).toHaveClass("bg-muted")
  })
})
