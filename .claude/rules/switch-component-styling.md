> **Single source of truth**: Before proposing any change, read [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# Switch Component Styling - Strict Rule

## MANDATORY REQUIREMENT

**NEVER apply `min-h-[44px]` or `min-w-[44px]` directly to Switch components.**

This rule is critical for maintaining correct visual appearance of toggle switches.

## Why This Rule Exists

The Shadcn UI Switch component has specific dimensions:
- Root: `h-6 w-11` (24px × 44px) with `rounded-full`
- Thumb: `h-5 w-5` (20px × 20px) with `rounded-full`

When `min-h-[44px] min-w-[44px]` is applied directly to a Switch:
1. The component stretches to 44×44px
2. The `rounded-full` creates a distorted oval/circle instead of a pill shape
3. The toggle appears "roundy" and unprofessional

## Correct vs Incorrect Usage

### INCORRECT - Distorted Switch

```tsx
// ❌ WRONG - Stretches the switch, creating ugly oval shape
<Switch
  checked={enabled}
  onCheckedChange={setEnabled}
  className="min-h-[44px] min-w-[44px]"
/>
```

### CORRECT - Standard Switch

```tsx
// ✅ CORRECT - Use default dimensions, touch target via parent
<Switch
  checked={enabled}
  onCheckedChange={setEnabled}
/>

// ✅ CORRECT - Custom colors are fine
<Switch
  checked={enabled}
  onCheckedChange={setEnabled}
  className="data-[state=checked]:bg-green-600"
/>
```

## Touch Target Requirements (WCAG 2.1 AA)

WCAG requires 44×44px minimum touch targets. For Switch components, achieve this via:

### 1. Parent Container Approach

```tsx
<div className="flex items-center justify-between p-3 min-h-[44px]">
  <Label htmlFor="toggle-feature">Enable feature</Label>
  <Switch id="toggle-feature" checked={enabled} onCheckedChange={setEnabled} />
</div>
```

### 2. Associated Label Approach

```tsx
<div className="flex items-center gap-2">
  <Label htmlFor="toggle-feature" className="cursor-pointer">
    Enable feature
  </Label>
  <Switch id="toggle-feature" checked={enabled} onCheckedChange={setEnabled} />
</div>
```

### 3. Clickable Row Approach

```tsx
<button
  onClick={() => setEnabled(!enabled)}
  className="flex items-center justify-between w-full p-3 min-h-[44px] rounded-md hover:bg-muted/50"
>
  <span>Enable feature</span>
  <Switch checked={enabled} onCheckedChange={setEnabled} />
</button>
```

## Allowed Customizations

The following className values ARE allowed on Switch:

| Allowed | Purpose |
|---------|---------|
| `data-[state=checked]:bg-green-600` | Custom checked color |
| `data-[state=checked]:bg-primary` | Theme-based checked color |
| `data-[state=unchecked]:bg-muted` | Custom unchecked color |
| `opacity-50` | Disabled appearance |
| `cursor-not-allowed` | Disabled cursor |

## Forbidden Patterns

| FORBIDDEN | Why |
|-----------|-----|
| `min-h-[44px]` | Stretches switch height, distorting shape |
| `min-w-[44px]` | Stretches switch width |
| `h-8`, `h-10`, etc. | Overrides default height |
| `w-14`, `w-16`, etc. | Overrides default width |
| `rounded-lg`, `rounded-md` | Overrides pill shape |

## Quick Reference

```tsx
// Pattern for feature toggles
<div className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted/70">
  <div className="flex-1">
    <p className="font-medium">Feature Name</p>
    <p className="text-sm text-muted-foreground">Description</p>
  </div>
  <div className="flex items-center gap-2 flex-shrink-0">
    <span className="text-sm text-muted-foreground">
      {enabled ? "On" : "Off"}
    </span>
    <Switch
      checked={enabled}
      onCheckedChange={setEnabled}
      className="data-[state=checked]:bg-green-600"
    />
  </div>
</div>
```

## Agent Responsibilities

All agents MUST:

1. **Never** add `min-h-[44px]` or `min-w-[44px]` to Switch components
2. **Always** achieve touch targets via parent containers
3. **Remove** incorrect sizing classes if found on existing Switch components
4. **Verify** Switch appears as proper pill shape after modifications
