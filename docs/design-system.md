# Design System

The whynot platform uses a token-based design system built on [Shadcn/ui](https://ui.shadcn.com) with Tailwind CSS.

## Tokens

All design tokens are defined as CSS custom properties in oklch color space. The full token reference lives in [`STYLES.md`](../STYLES.md) at the repo root.

Tokens are stored as raw `L C H` components, referenced in Tailwind via `oklch(var(--token) / <alpha-value>)` to support opacity modifiers.

### Semantic colors

| Token | Purpose |
|-------|---------|
| `--primary` | Primary actions (sky blue brand) |
| `--secondary` | Secondary actions |
| `--muted` | Subtle backgrounds, disabled states |
| `--accent` | Highlights, selected states |
| `--destructive` | Error states, delete actions |
| `--card` | Card surfaces |
| `--popover` | Dropdown/popover surfaces |

## Dark Mode

- Mechanism: `.dark` class on `<html>` element
- Persistence: `localStorage.theme` (`"light"`, `"dark"`, or `"system"`)
- Hook: `useTheme()` in `src/hooks/useTheme.ts`
- Provider: `<ThemeProvider>` wraps the app, provides context
- Toggle: `<ThemeToggle>` component in `src/components/ui/theme-toggle.tsx`
- Fallback: `prefers-color-scheme` media query when set to `"system"`

## RTL Support

- Mechanism: `dir` attribute on `<html>` element (`"ltr"` or `"rtl"`)
- Hook: `useDirection()` in `src/hooks/useDirection.ts`
- Provider: `<DirectionProvider>` wraps the app
- Detection: reads `localStorage.i18nextLng`, returns `"rtl"` for Arabic (`ar`), Hebrew (`he`), Farsi (`fa`), Urdu (`ur`)
- CSS: use Tailwind logical properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`, `start-`, `end-`)
- Icons: mirror directional icons with `rtl:scale-x-[-1]`

## Mobile-First

Every Tailwind class starts mobile and adds breakpoints progressively:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

## Do Not Hardcode Hex

All colors must reference CSS variables or Tailwind semantic tokens. Hardcoded hex/rgb values are forbidden outside `tailwind.config.ts` and `index.css`. This is enforced by stylelint with the `color-no-hex` rule.

### Color priority

1. Project tokens: `bg-background`, `text-foreground`, `bg-primary`
2. Shadcn semantic tokens: `bg-card`, `bg-popover`, `bg-accent`
3. Tailwind scale with dark variants: `bg-green-50 dark:bg-green-900/20`
4. Never: `bg-[#hex]`, `style={{ color: '#hex' }}`
