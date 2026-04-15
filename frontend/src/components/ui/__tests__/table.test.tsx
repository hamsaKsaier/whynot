import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../table"

describe("Table", () => {
  it("renders without crashing", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Test</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Test")).toBeInTheDocument()
  })

  it("TableHead uses text-start alignment", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead data-testid="th">Col</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow><TableCell>V</TableCell></TableRow>
        </TableBody>
      </Table>
    )
    expect(screen.getByTestId("th")).toHaveClass("text-start")
  })
})
