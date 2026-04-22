import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../tabs';

describe('Tabs', () => {
  it('renders tabs with content', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Content 1')).toBeInTheDocument();
  });

  it('switches content on tab click', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );

    await user.click(screen.getByText('Tab 2'));
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('renders tab triggers as buttons', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
  });

  it('supports controlled value', () => {
    render(
      <Tabs value="tab2">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });
});

describe('TabsList', () => {
  it('applies default classes', () => {
    render(
      <Tabs defaultValue="t">
        <TabsList data-testid="list">
          <TabsTrigger value="t">T</TabsTrigger>
        </TabsList>
        <TabsContent value="t">C</TabsContent>
      </Tabs>,
    );
    expect(screen.getByTestId('list')).toHaveClass('rounded-md', 'bg-muted');
  });
});

describe('TabsTrigger', () => {
  it('has disabled state', () => {
    render(
      <Tabs defaultValue="t">
        <TabsList>
          <TabsTrigger value="t" disabled>
            Disabled
          </TabsTrigger>
        </TabsList>
        <TabsContent value="t">C</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tab')).toBeDisabled();
  });
});
