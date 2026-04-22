# STYLES.md — whynot Platform Styling Guide

**Single source of truth for visual design.** This document defines the canonical color system, typography, spacing, shadows, and component patterns for the whynot AI-Powered QA platform. All frontends (`frontend/`, `admin-frontend/`) must follow these rules.

When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

---

## Overview

whynot uses a **Shadcn/ui + Tailwind CSS** design system with all colors defined in the **oklch** color space. The primary brand color is **sky blue** (`#0EA5E9` / `oklch(0.685 0.155 220)`). The neutral base is **zinc** (Shadcn default). Dark mode is toggled via the `.dark` class on `<html>`.

All CSS custom properties store raw `L C H` components (no `oklch()` wrapper) so that Tailwind opacity modifiers like `bg-primary/50` work correctly:

```css
/* How variables are stored */
--primary: 0.685 0.155 220;

/* How Tailwind consumes them */
background-color: oklch(var(--primary));          /* full opacity */
background-color: oklch(var(--primary) / 0.5);    /* 50% opacity */
```

---

## CSS Custom Properties

### Light Theme (`:root`)

```css
:root {
  /* Background & Foreground */
  --background: 1 0 0;
  --foreground: 0.141 0.005 286;

  /* Card */
  --card: 1 0 0;
  --card-foreground: 0.141 0.005 286;

  /* Popover */
  --popover: 1 0 0;
  --popover-foreground: 0.141 0.005 286;

  /* Primary — sky blue */
  --primary: 0.685 0.155 220;
  --primary-foreground: 0.985 0 0;

  /* Secondary */
  --secondary: 0.967 0.001 286;
  --secondary-foreground: 0.210 0.006 286;

  /* Muted */
  --muted: 0.967 0.001 286;
  --muted-foreground: 0.552 0.016 286;

  /* Accent */
  --accent: 0.967 0.001 286;
  --accent-foreground: 0.210 0.006 286;

  /* Destructive */
  --destructive: 0.577 0.245 27;
  --destructive-foreground: 0.985 0 0;

  /* Border & Input */
  --border: 0.920 0.004 286;
  --input: 0.920 0.004 286;

  /* Ring — matches primary */
  --ring: 0.685 0.155 220;

  /* Chart palette */
  --chart-1: 0.685 0.155 220;
  --chart-2: 0.6 0.18 160;
  --chart-3: 0.55 0.2 280;
  --chart-4: 0.65 0.2 50;
  --chart-5: 0.6 0.15 350;

  /* Selection */
  --selection: 0.623 0.214 259;
  --selection-foreground: 1 0 0;

  /* Radius */
  --radius: 0.625rem;

  /* Sidebar */
  --sidebar-background: 0.985 0 0;
  --sidebar-foreground: 0.141 0.005 286;
  --sidebar-primary: 0.685 0.155 220;
  --sidebar-primary-foreground: 0.985 0 0;
  --sidebar-accent: 0.967 0.001 286;
  --sidebar-accent-foreground: 0.210 0.006 286;
  --sidebar-border: 0.920 0.004 286;
  --sidebar-ring: 0.685 0.155 220;
}
```

### Dark Theme (`.dark`)

```css
.dark {
  /* Background & Foreground */
  --background: 0.141 0.005 286;
  --foreground: 0.985 0 0;

  /* Card */
  --card: 0.210 0.006 286;
  --card-foreground: 0.985 0 0;

  /* Popover */
  --popover: 0.210 0.006 286;
  --popover-foreground: 0.985 0 0;

  /* Primary — sky blue (brighter for dark bg) */
  --primary: 0.746 0.155 218;
  --primary-foreground: 0.141 0.005 286;

  /* Secondary */
  --secondary: 0.274 0.006 286;
  --secondary-foreground: 0.985 0 0;

  /* Muted */
  --muted: 0.274 0.006 286;
  --muted-foreground: 0.705 0.015 286;

  /* Accent */
  --accent: 0.372 0.013 286;
  --accent-foreground: 0.985 0 0;

  /* Destructive */
  --destructive: 0.65 0.2 25;
  --destructive-foreground: 0.985 0 0;

  /* Border & Input */
  --border: 0.274 0.006 286;
  --input: 0.372 0.013 286;

  /* Ring */
  --ring: 0.746 0.155 218;

  /* Chart palette */
  --chart-1: 0.746 0.155 218;
  --chart-2: 0.7 0.18 160;
  --chart-3: 0.65 0.2 280;
  --chart-4: 0.75 0.2 50;
  --chart-5: 0.7 0.15 350;

  /* Selection */
  --selection: 0.546 0.245 264;
  --selection-foreground: 1 0 0;

  /* Sidebar */
  --sidebar-background: 0.210 0.006 286;
  --sidebar-foreground: 0.985 0 0;
  --sidebar-primary: 0.746 0.155 218;
  --sidebar-primary-foreground: 0.141 0.005 286;
  --sidebar-accent: 0.372 0.013 286;
  --sidebar-accent-foreground: 0.985 0 0;
  --sidebar-border: 0.274 0.006 286;
  --sidebar-ring: 0.746 0.155 218;
}
```

---

## Status Colors

Semantic status colors for badges, alerts, and indicators. Each pair provides a light and dark variant.

| Status      | Light                            | Dark                             | Usage                        |
|-------------|----------------------------------|----------------------------------|------------------------------|
| Success     | `oklch(0.723 0.191 149)`        | `oklch(0.696 0.17 162)`         | Passed tests, healthy state  |
| Warning     | `oklch(0.795 0.184 86)`         | `oklch(0.768 0.17 80)`          | Flaky tests, degraded state  |
| Info        | `oklch(0.685 0.155 220)`        | `oklch(0.746 0.155 218)`        | Same as `--primary`          |
| Destructive | `oklch(0.577 0.245 27)`         | `oklch(0.65 0.2 25)`            | Failed tests, errors, delete |

### Status badge pattern

```tsx
// Success
<Badge className="bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300">
  <CheckCircle className="h-3 w-3 me-1" />
  Passed
</Badge>

// Warning
<Badge className="bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300">
  <AlertTriangle className="h-3 w-3 me-1" />
  Flaky
</Badge>

// Destructive
<Badge variant="destructive">
  <XCircle className="h-3 w-3 me-1" />
  Failed
</Badge>

// Info
<Badge className="bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300">
  <Info className="h-3 w-3 me-1" />
  Running
</Badge>
```

---

## Typography System

### Font Families

```css
:root {
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans",
    "Helvetica Neue", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;
}
```

The platform uses the system font stack. No custom web fonts are loaded. This ensures fast rendering and native feel on every OS.

### Text Scale

| Class      | Size      | Line Height | Usage                              |
|------------|-----------|-------------|------------------------------------|
| `text-xs`  | 0.75rem   | 1rem        | Badges, timestamps, metadata       |
| `text-sm`  | 0.875rem  | 1.25rem     | Secondary text, table cells, labels|
| `text-base`| 1rem      | 1.5rem      | Body text, descriptions            |
| `text-lg`  | 1.125rem  | 1.75rem     | Card titles, section labels        |
| `text-xl`  | 1.25rem   | 1.75rem     | Section headings                   |
| `text-2xl` | 1.5rem    | 2rem        | Page headings                      |
| `text-3xl` | 1.875rem  | 2.25rem     | Hero headings                      |
| `text-4xl` | 2.25rem   | 2.5rem      | Landing page headings only         |

### Font Weights

| Class          | Weight | Usage                               |
|----------------|--------|-------------------------------------|
| `font-light`   | 300    | Decorative large text (landing only)|
| `font-normal`  | 400    | Body text, descriptions             |
| `font-medium`  | 500    | Labels, navigation items, buttons   |
| `font-semibold`| 600    | Card titles, section headings       |
| `font-bold`    | 700    | Page headings, emphasis             |

### Typography patterns

```tsx
// Page heading
<h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
<p className="text-sm text-muted-foreground mt-1">Overview of your QA tests</p>

// Section heading
<h2 className="text-lg font-semibold text-foreground">Recent Runs</h2>

// Body text
<p className="text-base text-foreground">Test completed successfully.</p>

// Secondary / metadata
<span className="text-sm text-muted-foreground">3 minutes ago</span>

// Monospace (code, IDs, logs)
<code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded-md">run_abc123</code>
```

---

## Spacing System

Tailwind default spacing scale with a 4px base unit. Use only standard scale values.

| Token       | Value   | px   | Usage                               |
|-------------|---------|------|-------------------------------------|
| `space-0.5` | 0.125rem| 2    | Tight inline gaps                   |
| `space-1`   | 0.25rem | 4    | Icon-to-text gap                    |
| `space-1.5` | 0.375rem| 6    | Compact padding                     |
| `space-2`   | 0.5rem  | 8    | Form group gap, badge padding       |
| `space-3`   | 0.75rem | 12   | List item padding                   |
| `space-4`   | 1rem    | 16   | Card padding (compact), button px   |
| `space-5`   | 1.25rem | 20   | Section gap (small)                 |
| `space-6`   | 1.5rem  | 24   | Card padding (default), card gap    |
| `space-8`   | 2rem    | 32   | Section gap (medium)                |
| `space-10`  | 2.5rem  | 40   | Page section gap                    |
| `space-12`  | 3rem    | 48   | Major section separation            |
| `space-16`  | 4rem    | 64   | Page-level vertical padding         |
| `space-20`  | 5rem    | 80   | Landing page section gap            |
| `space-24`  | 6rem    | 96   | Landing page hero spacing           |

**Rule**: Do not use arbitrary spacing values (`p-[13px]`, `gap-[22px]`). Use the standard Tailwind scale. See `uncodixify-ui` rules for details.

---

## Border Radius System

All radii derive from the `--radius` custom property (`0.625rem` = 10px).

| Token        | Value                  | Computed | Usage                        |
|--------------|------------------------|----------|------------------------------|
| `rounded-sm` | `calc(var(--radius) - 4px)` | 6px  | Small badges, inline code    |
| `rounded-md` | `calc(var(--radius) - 2px)` | 8px  | Buttons, inputs, dropdowns   |
| `rounded-lg` | `var(--radius)`             | 10px | Cards, dialogs, panels       |
| `rounded-xl` | `calc(var(--radius) + 4px)` | 14px | Large modals (use sparingly) |
| `rounded-2xl`| `calc(var(--radius) + 8px)` | 18px | **Forbidden** -- too rounded |

**Rules**:
- Buttons: `rounded-md` (8px max)
- Cards: `rounded-lg` (10px)
- Never use `rounded-full` on containers or cards
- Never use `rounded-2xl` or `rounded-3xl` on any element
- `rounded-full` is acceptable only on avatars and circular icon buttons

---

## Shadow System

Shadows use oklch-based opacity for consistency with the color system.

| Token        | Value                                                                              | Usage                       |
|--------------|------------------------------------------------------------------------------------|-----------------------------|
| `shadow-2xs` | `0 1px oklch(0 0 0 / 0.05)`                                                       | Subtle depth hint           |
| `shadow-xs`  | `0 1px 2px oklch(0 0 0 / 0.05)`                                                   | Input fields, small cards   |
| `shadow-sm`  | `0 1px 3px oklch(0 0 0 / 0.1), 0 1px 2px -1px oklch(0 0 0 / 0.1)`               | Default card shadow         |
| `shadow-md`  | `0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1)`          | Dropdowns, popovers only    |
| `shadow-lg`  | `0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1)`        | Modals, dialogs only        |
| `shadow-xl`  | `0 20px 25px -5px oklch(0 0 0 / 0.1), 0 8px 10px -6px oklch(0 0 0 / 0.1)`       | **Reserved** -- rarely used |
| `shadow-2xl` | `0 25px 50px -12px oklch(0 0 0 / 0.25)`                                           | **Forbidden** in app UI     |

**Rules**:
- Cards: `shadow-sm` only. Never escalate shadow on hover.
- Dropdowns/popovers: `shadow-md` is the ceiling.
- Dialogs/modals: `shadow-lg` max.
- Never use `shadow-xl` or `shadow-2xl` in the application UI.
- Never add `hover:shadow-md` or `hover:shadow-lg` to cards. See `uncodixify-ui` rules.

---

## Focus Ring

All interactive elements must show a visible focus ring for keyboard navigation (WCAG 2.1 AA).

```css
*:focus-visible {
  outline: 2px solid oklch(var(--ring));
  outline-offset: 2px;
}
```

| Property        | Value                      | Notes                         |
|-----------------|----------------------------|-------------------------------|
| Color           | `var(--ring)` (sky blue)   | Matches primary brand color   |
| Width           | 2px                        | Visible but not overwhelming  |
| Offset          | 2px                        | Separates ring from element   |
| Style           | solid                      | No dashed or dotted           |

**Rules**:
- Never remove `outline` on `:focus-visible`.
- Never use `outline-none` without providing an alternative visible indicator.
- Shadcn components handle focus rings automatically; do not override unless necessary.

---

## Selection Colors

Text selection uses the `--selection` and `--selection-foreground` variables for a branded highlight that meets WCAG 2.1 AA contrast requirements.

```css
::selection {
  background-color: oklch(var(--selection));
  color: oklch(var(--selection-foreground));
}
```

| Theme | Background                    | Foreground          | Contrast Ratio |
|-------|-------------------------------|---------------------|----------------|
| Light | `oklch(0.623 0.214 259)`     | `oklch(1 0 0)`     | >= 4.5:1       |
| Dark  | `oklch(0.546 0.245 264)`     | `oklch(1 0 0)`     | >= 4.5:1       |

---

## Color Usage Rules

### Do not hardcode hex values

All colors must use CSS custom properties or Tailwind semantic tokens. Hardcoded hex (`#0EA5E9`), rgb (`rgb(14, 165, 233)`), or hsl values are **forbidden** outside of `tailwind.config.ts` and `globals.css`.

```tsx
// CORRECT — semantic tokens
<div className="bg-primary text-primary-foreground" />
<div className="bg-card text-card-foreground border-border" />
<div className="text-muted-foreground" />

// CORRECT — Tailwind scale with dark variants for status colors
<div className="bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-300" />

// WRONG — hardcoded hex
<div className="bg-[#0EA5E9]" />
<div style={{ color: "#0EA5E9" }} />
<div className="text-[rgb(14,165,233)]" />
```

**Enforcement**: This rule can be enforced via `stylelint` with the `color-no-hex` rule in component stylesheets. The only files exempt from this rule are:

- `tailwind.config.ts` / `tailwind.config.js` (color palette definition)
- `globals.css` / `index.css` (CSS custom property definitions)

### Color priority order

1. **CSS custom properties** -- `bg-background`, `text-foreground`, `bg-primary`, etc.
2. **Shadcn semantic tokens** -- `bg-card`, `bg-popover`, `bg-accent`, `bg-destructive`, etc.
3. **Tailwind scale with dark variants** -- `bg-green-50 dark:bg-green-900/20` for status colors.
4. **Never** arbitrary hex/rgb/hsl values.

---

## cn() Utility

The `cn()` utility merges Tailwind classes with proper conflict resolution using `clsx` and `tailwind-merge`.

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Usage

```tsx
import { cn } from "@/lib/utils";

// Conditional classes
<div className={cn(
  "rounded-lg border bg-card text-card-foreground shadow-sm",
  isActive && "border-primary",
  isDisabled && "opacity-50 cursor-not-allowed"
)} />

// Merging with prop overrides (last wins)
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm p-6", className)}
      {...props}
    />
  );
}
```

**Rules**:
- Always use `cn()` when combining conditional classes.
- Always use `cn()` in component APIs that accept a `className` prop — pass the prop last so consumers can override defaults.
- Never concatenate class strings manually (`className={base + " " + extra}`).

---

## Button Variants

All buttons follow the Shadcn `Button` component API. The allowed variants and sizes are:

### Variants

| Variant       | Classes                                                         | Usage                          |
|---------------|-----------------------------------------------------------------|--------------------------------|
| `default`     | `bg-primary text-primary-foreground hover:bg-primary/90`       | Primary actions (Deploy, Save) |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Delete, remove actions    |
| `outline`     | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` | Secondary actions     |
| `secondary`   | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | Tertiary actions               |
| `ghost`       | `hover:bg-accent hover:text-accent-foreground`                 | Toolbar buttons, inline actions|
| `link`        | `text-primary underline-offset-4 hover:underline`              | Inline text links              |

### Sizes

| Size    | Classes                        | Usage                          |
|---------|--------------------------------|--------------------------------|
| `sm`    | `h-8 rounded-md px-3 text-xs`  | Table row actions, compact UI  |
| `default`| `h-9 px-4 py-2`              | Standard buttons               |
| `lg`    | `h-10 rounded-md px-8`        | Prominent CTAs                 |
| `icon`  | `h-9 w-9`                     | Icon-only buttons              |

### Button patterns

```tsx
// Primary action
<Button>Run Tests</Button>

// With loading state
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="h-4 w-4 me-2 animate-spin" />
      Running...
    </>
  ) : (
    <>
      <Play className="h-4 w-4 me-2" />
      Run Tests
    </>
  )}
</Button>

// Destructive
<Button variant="destructive" size="sm">
  <Trash2 className="h-4 w-4 me-2" />
  Delete
</Button>

// Ghost (icon-only)
<Button variant="ghost" size="icon">
  <Settings className="h-4 w-4" />
</Button>
```

**Rules**:
- All buttons use `rounded-md`. Never `rounded-full` (pill shape).
- Loading states use `Loader2` with `animate-spin`. Never `animate-bounce`.
- Icon spacing uses `me-2` (logical property), never `mr-2`.
- Transitions use `transition-colors duration-150`. Never `transition-all`.

---

## Card Component

Cards are the primary content container. They must be flat, functional, and consistent.

### Base card

```tsx
<Card className="rounded-lg border bg-card text-card-foreground shadow-sm">
  <CardHeader>
    <CardTitle className="text-lg font-semibold">Test Suite</CardTitle>
    <CardDescription className="text-sm text-muted-foreground">
      End-to-end tests for authentication flow
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter className="flex items-center justify-between">
    <span className="text-sm text-muted-foreground">Last run: 5m ago</span>
    <Button size="sm">View Results</Button>
  </CardFooter>
</Card>
```

### Card rules

| Property   | Allowed                  | Forbidden                                   |
|------------|--------------------------|---------------------------------------------|
| Radius     | `rounded-lg`             | `rounded-2xl`, `rounded-3xl`, `rounded-full`|
| Shadow     | `shadow-sm`              | `shadow-md`, `shadow-lg`, hover escalation   |
| Hover      | `hover:bg-muted/50`      | `hover:-translate-y-1`, `hover:shadow-lg`    |
| Background | `bg-card`                | Gradients, glassmorphism, `backdrop-blur`    |
| Border     | `border` (uses --border) | `ring-2 ring-offset-2`                      |
| Transition | `transition-colors`      | `transition-all`, `duration-300`+            |

### Interactive card (clickable row style)

```tsx
<div className="flex items-center gap-4 p-4 border-b hover:bg-muted/50 transition-colors duration-150">
  <div className="flex-1 min-w-0">
    <p className="font-medium text-foreground truncate">Login Flow Tests</p>
    <p className="text-sm text-muted-foreground">24 tests, 2 suites</p>
  </div>
  <Badge variant="outline" className="bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300">
    Passed
  </Badge>
  <Button variant="ghost" size="sm">
    View
    <ArrowRight className="h-4 w-4 ms-1 rtl:scale-x-[-1]" />
  </Button>
</div>
```

---

## Implementation Checklist

Use this checklist before merging any UI change.

### Dark mode
- [ ] All colors use semantic tokens (`bg-background`, `text-foreground`, etc.)
- [ ] Status colors include explicit `dark:` variants
- [ ] No hardcoded `bg-white`, `text-gray-900`, or `bg-black`
- [ ] Tested in both light and dark modes

### RTL / Logical Properties
- [ ] Margin: `ms-*` / `me-*` instead of `ml-*` / `mr-*`
- [ ] Padding: `ps-*` / `pe-*` instead of `pl-*` / `pr-*`
- [ ] Text alignment: `text-start` / `text-end` instead of `text-left` / `text-right`
- [ ] Borders: `border-s-*` / `border-e-*` instead of `border-l-*` / `border-r-*`
- [ ] Directional icons include `rtl:scale-x-[-1]`
- [ ] No `rtl:flex-row-reverse` (native `dir="rtl"` handles flex reversal)

### Accessibility (WCAG 2.1 AA)
- [ ] Color contrast >= 4.5:1 for normal text, >= 3:1 for large text
- [ ] Focus ring visible on all interactive elements (`:focus-visible`)
- [ ] Touch targets >= 44x44px (via parent container, not on Switch/small components)
- [ ] Selection colors meet contrast requirements
- [ ] No information conveyed by color alone (use icons/text alongside)

### Uncodixify compliance
- [ ] No `hover:-translate-y-*` or `hover:scale-*` on any element
- [ ] No `hover:shadow-md` or shadow escalation
- [ ] No `animate-bounce` or decorative `animate-pulse`
- [ ] No `transition-all`; use `transition-colors` or `transition-opacity`
- [ ] No `duration-300`+; max `duration-200`
- [ ] No `rounded-full` on containers/cards
- [ ] No gradient backgrounds or gradient text
- [ ] No glassmorphism / `backdrop-blur`
- [ ] Buttons use `rounded-md`, cards use `rounded-lg`

### Color system
- [ ] No hardcoded hex/rgb/hsl in component files
- [ ] All colors from CSS custom properties or Tailwind semantic tokens
- [ ] Status colors use Tailwind scale with `dark:` variants
- [ ] Charts use `--chart-1` through `--chart-5` variables
