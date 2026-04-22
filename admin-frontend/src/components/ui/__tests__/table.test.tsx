import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '../table';

describe('Table', () => {
  it('renders a table element', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders wrapped in a scrollable div', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.firstChild).toHaveClass('overflow-auto');
  });
});

describe('TableHeader', () => {
  it('renders thead', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Head</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(container.querySelector('thead')).toBeInTheDocument();
  });
});

describe('TableBody', () => {
  it('renders tbody', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Body cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('tbody')).toBeInTheDocument();
  });
});

describe('TableFooter', () => {
  it('renders tfoot', () => {
    const { container } = render(
      <Table>
        <TableFooter>
          <TableRow>
            <TableCell>Footer</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    expect(container.querySelector('tfoot')).toBeInTheDocument();
  });
});

describe('TableRow', () => {
  it('renders tr', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('tr')).toBeInTheDocument();
  });

  it('applies border-b class', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('tr')).toHaveClass('border-b');
  });
});

describe('TableHead', () => {
  it('renders th', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Header</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(container.querySelector('th')).toBeInTheDocument();
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('applies text-start alignment', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>H</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(container.querySelector('th')).toHaveClass('text-start');
  });
});

describe('TableCell', () => {
  it('renders td', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Data</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('td')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
  });
});

describe('TableCaption', () => {
  it('renders caption', () => {
    const { container } = render(
      <Table>
        <TableCaption>A list of items</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector('caption')).toBeInTheDocument();
    expect(screen.getByText('A list of items')).toBeInTheDocument();
  });
});
