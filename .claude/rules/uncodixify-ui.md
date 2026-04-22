> **Single source of truth**: Before proposing any change, read [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# Uncodixify UI Standards - Strict Rule

## MANDATORY REQUIREMENT

**All UI components MUST follow Uncodixify principles.** Build interfaces that feel human-designed, functional, and honest -- like Linear, Raycast, Stripe, and GitHub -- not like default AI-generated output.

AI-generated UIs ("Codex aesthetics") share recognizable tells: card lift effects, decorative animations, shadow escalation, gradient text, glassmorphism, pill-shaped buttons, and excessive rounded corners. These patterns signal "template" rather than "product." This rule eliminates them.

## "Keep It Normal" Reference

| Element | Correct | Wrong |
|---------|---------|-------|
| Sidebar | Static left rail or top nav, no icons-only collapse gimmick | Floating icon sidebar with expand animation |
| Page header | `text-2xl font-semibold` on `bg-background`, no decoration | Gradient background, decorative SVG blobs |
| Cards | `rounded-lg border bg-card shadow-sm`, flat on hover | `hover:-translate-y-1 hover:shadow-lg` lift effect |
| Buttons | `rounded-md` (max 8px radius), solid fill or outline | `rounded-full` pill shape, gradient fill |
| Transitions | `transition-colors duration-150` for interactive states | `transition-all duration-300` with transform |
| Shadows | `shadow-sm` only; `shadow-none` is fine too | `shadow-md`, `shadow-lg`, shadow escalation on hover |
| Typography | System font stack or single project font, regular weights | Multiple decorative fonts, gradient text |
| Spacing | 4/8/12/16/24/32px (Tailwind default scale) | Arbitrary values (`p-[13px]`, `gap-[22px]`) |
| Border radius | `rounded-md` buttons, `rounded-lg` cards, max 12px | `rounded-2xl`, `rounded-3xl`, `rounded-full` on containers |
| Status indicators | Static badge with semantic color | `animate-pulse` on badges, `animate-bounce` on icons |
| Loading states | `Loader2` with `animate-spin`, or skeleton | `animate-pulse` on content, `animate-bounce` on buttons |
| Hover states | `hover:bg-muted/50` or `hover:bg-accent` | `hover:-translate-y-1`, `hover:shadow-md`, `hover:scale-105` |

## Banned Patterns

| Pattern | Why It's Banned | Alternative |
|---------|----------------|-------------|
| `hover:-translate-y-1` | Card "lift" is a Codex tell | `hover:bg-muted/50` or `hover:border-primary/50` |
| `hover:shadow-md` / `hover:shadow-lg` | Shadow escalation feels template-y | Keep `shadow-sm` static, use border/bg change |
| `animate-bounce` | Decorative motion, not functional | `animate-spin` on `Loader2` for loading only |
| `animate-pulse` on badges/buttons | Draws false urgency | Static badge; `animate-spin` on loader icon only |
| `transition-all` | Transitions everything including layout | `transition-colors` or `transition-opacity` |
| `duration-300` / `duration-500` | Too slow, feels sluggish | `duration-150` (max `duration-200`) |
| `rounded-full` on containers/cards | Looks like a toy | `rounded-lg` (max 12px) |
| `rounded-2xl` / `rounded-3xl` | Over-rounded, Codex aesthetic | `rounded-lg` for cards, `rounded-md` for buttons |
| `bg-gradient-to-*` on backgrounds | Gradient backgrounds feel decorative | Solid `bg-background` or `bg-muted` |
| `bg-clip-text text-transparent` | Gradient text is a Codex signature | Solid `text-foreground` or semantic color |
| `backdrop-blur` / glassmorphism | Frosted glass is decorative, hurts readability | Solid `bg-card` or `bg-popover` |
| `ring-2 ring-offset-2` on cards | Overly prominent selection ring | `ring-1 ring-primary` (no offset) |
| `shadow-lg` / `shadow-xl` / `shadow-2xl` | Excessive depth | `shadow-sm` max |
| `scale-105` / `scale-110` on hover | Zoom effect is a Codex tell | No scale transforms on hover |
| `group-hover:opacity-100` overlays | Hidden-until-hover content | Always-visible inline actions |

## Code Examples

### Card Styling

```typescript
// CORRECT -- flat, functional card
<Card className="rounded-lg border bg-card text-card-foreground shadow-sm">
  <CardHeader>
    <CardTitle className="text-lg font-semibold">Service Name</CardTitle>
    <CardDescription>PostgreSQL 16 on us-east-1</CardDescription>
  </CardHeader>
</Card>

// WRONG -- Codex aesthetic card
<Card className="rounded-2xl border bg-card shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
```

### Status Badges

```typescript
// CORRECT -- static badge
<Badge variant="outline" className="gap-1.5 bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300">
  <CheckCircle className="h-3 w-3" />
  Running
</Badge>

// WRONG -- animated badge
<Badge className="animate-pulse bg-green-500 text-white rounded-full">
```

### Deploy Buttons

```typescript
// CORRECT -- subtle loading state
<Button variant="default" size="sm" disabled={isDeploying}>
  {isDeploying ? (
    <>
      <Loader2 className="h-4 w-4 me-1 animate-spin" />
      Deploying...
    </>
  ) : (
    <>
      <Rocket className="h-4 w-4 me-1" />
      Deploy
    </>
  )}
</Button>

// WRONG -- bouncing icon
<Button>
  <Rocket className={cn("h-4 w-4 me-1", isDeploying && "animate-bounce")} />
  Deploy
</Button>
```

### Interactive List Items

```typescript
// CORRECT -- subtle hover
<div className="flex items-center gap-4 p-4 border-b hover:bg-muted/50 transition-colors duration-150">

// WRONG -- lift + shadow
<div className="flex items-center gap-4 p-4 border-b hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
```

### Button Shapes

```typescript
// CORRECT -- modest radius
<Button className="rounded-md">Deploy</Button>
<Button variant="outline" className="rounded-md">Settings</Button>

// WRONG -- pill buttons
<Button className="rounded-full px-8">Get Started</Button>
```

## Color Palette Priority

Use colors in this order of preference:

1. **Project tokens** -- `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, etc.
2. **Shadcn semantic tokens** -- `bg-card`, `bg-popover`, `bg-accent`, `bg-destructive`, etc.
3. **Tailwind scale with dark variants** -- `bg-green-50 dark:bg-green-900/20` for status colors
4. **NEVER random hex/rgb** -- No `bg-[#7c3aed]`, no `style={{ color: '#ff6b35' }}`

### Light Mode Palette

| Role | Token / Class | Usage |
|------|---------------|-------|
| Page background | `bg-background` | Main content area |
| Card surface | `bg-card` | Cards, panels |
| Subtle surface | `bg-muted` | Secondary areas, code blocks |
| Primary action | `bg-primary` | Main CTA buttons |
| Destructive | `bg-destructive` | Delete buttons, error states |
| Border | `border-border` | All borders |
| Primary text | `text-foreground` | Headings, body text |
| Secondary text | `text-muted-foreground` | Descriptions, labels, metadata |

### Dark Mode Palette

All components MUST use semantic tokens that adapt automatically. Never hardcode light-only or dark-only colors.

```typescript
// CORRECT -- adapts to both modes
<div className="bg-card text-card-foreground border-border" />

// CORRECT -- explicit dark variant for status colors
<div className="bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-300" />

// WRONG -- light-only
<div className="bg-white text-gray-900 border-gray-200" />
<div style={{ backgroundColor: "#ffffff" }} />
```

## Animation Rules

| Allowed | Context | Duration |
|---------|---------|----------|
| `animate-spin` | Loading spinners (`Loader2` icon) | Default |
| `transition-colors` | Hover/focus state changes | `duration-150` |
| `transition-opacity` | Show/hide, fade in/out | `duration-150` |
| Animated counters | Landing page stats (counting up) | One-time on viewport entry |
| Slide-in toolbar | Bulk selection toolbar appearing | `duration-200` max |

| Banned | Context | Why |
|--------|---------|-----|
| `animate-bounce` | Any element | Decorative, distracting |
| `animate-pulse` | Badges, buttons, cards | False urgency, Codex tell |
| `animate-ping` | Any non-notification element | Overly attention-seeking |
| `transition-all` | Any element | Over-broad, causes layout shifts |
| `duration-300`+ | Any interactive transition | Too slow, feels sluggish |
| `hover:scale-*` | Any element | Zoom is a Codex tell |
| `hover:-translate-y-*` | Any element | Lift effect is a Codex tell |

**Exception**: `animate-pulse` is acceptable ONLY on skeleton loading placeholders (e.g., `<Skeleton className="animate-pulse" />`).

## Complementary Rules

This rule works alongside:

- **`.claude/rules/service-component-patterns.md`** -- Service tab structure and styling
- **`.claude/rules/rtl-support-arabic.md`** -- Logical properties, icon mirroring
- **`.claude/rules/switch-component-styling.md`** -- Switch component dimensions
- **`.claude/rules/bulk-selection-patterns.md`** -- Selection UI patterns

When any of these rules conflicts with Uncodixify standards, Uncodixify takes precedence for visual styling decisions.

## Validation Checklist

Before completing any UI component:

- [ ] No `hover:-translate-y-*` on any element
- [ ] No `hover:shadow-md` or `hover:shadow-lg` (shadow stays `shadow-sm` or less)
- [ ] No `animate-bounce` anywhere
- [ ] No decorative `animate-pulse` (only on Skeleton placeholders)
- [ ] No `transition-all` (use `transition-colors` or `transition-opacity`)
- [ ] No `duration-300` or higher (max `duration-200`)
- [ ] No `rounded-full` on containers, cards, or non-icon buttons
- [ ] No `rounded-2xl` or `rounded-3xl`
- [ ] No gradient backgrounds or gradient text
- [ ] No glassmorphism / `backdrop-blur`
- [ ] No `scale-*` transforms on hover
- [ ] No `ring-2 ring-offset-2` on cards (use `ring-1 ring-primary`)
- [ ] All colors use project tokens or Shadcn semantic tokens
- [ ] `Loader2` with `animate-spin` for all loading states
- [ ] Buttons use `rounded-md`, cards use `rounded-lg`
