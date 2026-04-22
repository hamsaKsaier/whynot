import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "../dialog"

describe("Dialog", () => {
  it("renders trigger without crashing", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText("Open")).toBeInTheDocument()
  })
})
