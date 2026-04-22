import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '../sheet';

describe('Sheet', () => {
  it('renders content when open', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>Sheet description</SheetDescription>
          </SheetHeader>
          <p>Sheet body</p>
          <SheetFooter>Footer content</SheetFooter>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText('Sheet Title')).toBeInTheDocument();
    expect(screen.getByText('Sheet description')).toBeInTheDocument();
    expect(screen.getByText('Sheet body')).toBeInTheDocument();
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <Sheet open={false}>
        <SheetContent>
          <SheetTitle>Hidden</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('renders close button', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Test</SheetTitle>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});

describe('SheetHeader', () => {
  it('renders with flex-col class', () => {
    const { container } = render(<SheetHeader>Header</SheetHeader>);
    expect(container.firstChild).toHaveClass('flex', 'flex-col');
  });
});

describe('SheetFooter', () => {
  it('renders footer', () => {
    const { container } = render(<SheetFooter>Footer</SheetFooter>);
    expect(container.firstChild).toHaveClass('flex');
  });
});
