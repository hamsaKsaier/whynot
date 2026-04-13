> **Single source of truth**: Before proposing any change, read [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# RTL Support for Arabic - Best Practice Guide

## RECOMMENDED APPROACH

All UI components SHOULD support RTL (Right-to-Left) for Arabic language to ensure a great user experience. This guide provides comprehensive patterns and best practices for RTL implementation.

## Property Mapping

Use CSS logical properties instead of physical directional properties:

| AVOID (Physical) | USE INSTEAD (Logical) |
|------------------|----------------------|
| `ml-*`, `mr-*` | `ms-*`, `me-*` (margin-inline-start/end) |
| `pl-*`, `pr-*` | `ps-*`, `pe-*` (padding-inline-start/end) |
| `left-*`, `right-*` | `start-*`, `end-*` |
| `text-left`, `text-right` | `text-start`, `text-end` |
| `border-l-*`, `border-r-*` | `border-s-*`, `border-e-*` |
| `rounded-l-*`, `rounded-r-*` | `rounded-s-*`, `rounded-e-*` |
| `float-left`, `float-right` | `float-start`, `float-end` |

### Examples

```tsx
// AVOID - Physical properties
<div className="ml-4 mr-2 text-left border-l-2">

// USE - Logical properties
<div className="ms-4 me-2 text-start border-s-2">
```

## Flex Direction Handling (CRITICAL)

**IMPORTANT:** This project sets `dir="rtl"` on the HTML element for Arabic language. This means CSS flexbox automatically reverses `flex-row` to flow right-to-left. **DO NOT** add `rtl:flex-row-reverse` as it causes double-reversal!

### How Native RTL Works

When `dir="rtl"` is set on a parent element (our app sets it on `<html>`):
- `flex-row` automatically flows right-to-left
- `justify-start` aligns to the right
- `justify-end` aligns to the left
- Content flows in the correct reading direction

### Pattern

```tsx
// CORRECT - Native RTL handles reversal automatically
<div className="flex flex-row items-center justify-between">
  <span>Start content</span>
  <span>End content</span>
</div>

// For responsive layouts
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
```

### Common Mistake (AVOID)

```tsx
// WRONG - Causes double-reversal (appears LTR in Arabic!)
<div className="flex flex-row rtl:flex-row-reverse items-center">
```

When `dir="rtl"` is set:
1. `flex-row` reverses → content flows RTL ✓
2. `rtl:flex-row-reverse` applies → reverses AGAIN → content flows LTR ✗

### When to Use `rtl:flex-row-reverse`

Only use this pattern when:
- You are NOT setting `dir="rtl"` on a parent element
- You need manual control over flex direction per-element
- The component must work without the global RTL attribute

For whynot (which uses `dir="rtl"` on HTML), **NEVER use `rtl:flex-row-reverse`**.

## Icon Mirroring

Directional icons MUST be mirrored in RTL mode using `rtl:scale-x-[-1]`.

### Icons That MUST Mirror

From `@/lib/rtl` - `MIRROR_ICONS` list:
- Navigation: `ChevronLeft`, `ChevronRight`, `ArrowLeft`, `ArrowRight`
- Actions: `Undo`, `Redo`, `Reply`, `Forward`, `Share`
- Media: `SkipBack`, `SkipForward`, `Rewind`, `FastForward`
- UI: `LogIn`, `LogOut`, `ExternalLink`, `MoveLeft`, `MoveRight`

### Icons That Should NOT Mirror

- Symmetric icons: `Search`, `Settings`, `User`, `Home`, `Plus`, `X`
- Global icons: `Globe`, `Sun`, `Moon`
- Vertical icons: `ChevronUp`, `ChevronDown`

### Pattern

```tsx
import { ArrowRight, ChevronRight } from "lucide-react";

// CORRECT - Icon mirrors in RTL
<ArrowRight className="h-4 w-4 ms-1 rtl:scale-x-[-1]" />
<ChevronRight className="h-4 w-4 me-2 rtl:scale-x-[-1]" />

// Using the utility function
import { getMirrorClass } from "@/lib/rtl";

<ArrowRight className={cn("h-4 w-4 ms-1", getMirrorClass("ArrowRight"))} />
```

## Table Alignment

Tables should use logical text alignment:

```tsx
<TableHead className="text-start">Name</TableHead>
<TableHead className="text-end">Actions</TableHead>

<TableCell className="text-start">{data.name}</TableCell>
<TableCell className="text-end">
  <ActionButtons />
</TableCell>
```

## Form Layouts

Form layouts should flow correctly in RTL. Since `dir="rtl"` is set on HTML, flexbox automatically handles the reversal:

```tsx
// Horizontal form - native RTL handles flow automatically
<form className="flex flex-col sm:flex-row gap-4">
  <Input className="flex-1" placeholder="Email" />
  <Select className="w-[140px]">...</Select>
  <Button type="submit">Submit</Button>
</form>
```

## Component Patterns

### Cards with Actions

```tsx
<Card>
  <CardHeader className="flex items-center justify-between">
    <CardTitle>Title</CardTitle>
    <Button variant="ghost" size="sm">
      Action
      <ArrowRight className="h-4 w-4 ms-1 rtl:scale-x-[-1]" />
    </Button>
  </CardHeader>
</Card>
```

### Danger Zone / Alert Sections

```tsx
// Native RTL handles layout reversal - no rtl:flex-row-reverse needed
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
  <div>
    <h4>Dangerous Action</h4>
    <p className="text-muted-foreground">Description...</p>
  </div>
  <Button variant="destructive">
    <Trash2 className="h-4 w-4 me-2" />
    Delete
  </Button>
</div>
```

### Navigation Breadcrumbs

```tsx
<nav className="flex items-center gap-2">
  <Link to="/">Home</Link>
  <ChevronRight className="h-4 w-4 text-muted-foreground rtl:scale-x-[-1]" />
  <Link to="/settings">Settings</Link>
  <ChevronRight className="h-4 w-4 text-muted-foreground rtl:scale-x-[-1]" />
  <span>Current Page</span>
</nav>
```

## Validation Checklist

Before completing RTL-sensitive components:

- [ ] No physical directional classes (`ml-*`, `mr-*`, `pl-*`, `pr-*`, etc.)
- [ ] **NO** `rtl:flex-row-reverse` on flex layouts (native RTL handles this)
- [ ] Directional icons have `rtl:scale-x-[-1]` class
- [ ] Tables use `text-start` / `text-end` for alignment
- [ ] Form layouts use standard `flex-row` (no RTL variants needed)
- [ ] Dropdown menus use `align="end"` (shadcn handles RTL)
- [ ] Border decorations use `border-s-*` / `border-e-*`

## Testing in Arabic

1. **Switch language**: Go to Settings > Language > Arabic
2. **Verify layout**: Check that content flows right-to-left
3. **Check icons**: Directional icons should point in logical direction
4. **Test interactions**: Forms, dropdowns, and modals work correctly
5. **Mobile view**: Responsive layouts adapt properly

## Pre-Commit Validation

Run RTL validation before committing:

```bash
# Via Docker (required)
docker exec -it serverless-client npm run rtl:check

# Or via make command
make rtl-check
```

## Resources

- RTL Utilities: `frontend/src/lib/rtl.ts`
- Icon Lists: `MIRROR_ICONS`, `NO_MIRROR_ICONS` in rtl.ts
- Direction Hook: `useDirection()` from `@/lib/rtl`
- Tailwind RTL: Uses built-in `rtl:` and `ltr:` variants
- i18n RTL Setup: `frontend/src/i18n.ts` (sets `dir="rtl"` on HTML element)

## Technical Note: How RTL is Implemented

whynot uses native browser RTL support:

1. **i18n sets `dir` attribute**: When Arabic is selected, `document.documentElement.dir = "rtl"` is set
2. **CSS responds automatically**: All CSS layout properties (flexbox, grid, positioning) respect the `dir` attribute
3. **Logical properties work**: `ms-*`, `me-*`, `start-*`, `end-*` all flip correctly
4. **Tailwind `rtl:` variant**: Only needed for properties that DON'T auto-flip (like icon transforms)

This is why `rtl:flex-row-reverse` causes issues - flexbox already reverses in RTL mode!
