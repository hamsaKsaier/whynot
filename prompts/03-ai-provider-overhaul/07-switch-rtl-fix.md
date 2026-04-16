# 07 — Switch Component RTL Fix

## Agent
`frontend-developer`

## Skills referenced
- `.claude/rules/rtl-support-arabic.md`
- `.claude/rules/switch-component-styling.md`

## Dependencies
None (fully independent — can be executed in parallel with any other prompt in this series)

## Task

Fix the Switch component's thumb translation in RTL mode. Currently, when `dir="rtl"` is set on the HTML element (Arabic language), the Switch thumb slides RIGHT when checked — same direction as LTR. It should slide LEFT in RTL mode.

### 1. Fix Frontend Switch Component

**File:** `frontend/src/components/ui/switch.tsx` (line 19)

**Current (broken in RTL):**
```tsx
"pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform duration-150 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
```

**Fixed:**
```tsx
"pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform duration-150 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5 data-[state=unchecked]:translate-x-0"
```

The key addition is `rtl:data-[state=checked]:-translate-x-5` which negates the translate direction when `dir="rtl"` is active.

### 2. Fix Admin Frontend Switch Component

**File:** `admin-frontend/src/components/ui/switch.tsx` (line 19)

Apply the identical fix. Both files are currently identical and should remain so.

### 3. Fix NotificationPreferences Custom Switch

**File:** `frontend/src/components/NotificationPreferences.tsx` (lines 131-133)

This file has a custom switch implementation that uses `translate-x-6` for the checked state. Apply the same RTL pattern:

**Current:**
```tsx
enabled ? 'translate-x-6' : 'translate-x-1'
```

**Fixed:**
```tsx
enabled ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-1 rtl:-translate-x-1'
```

Note: The unchecked state also needs RTL handling since `translate-x-1` positions the thumb slightly to the right in LTR; in RTL it should be slightly to the left.

### 4. Rules Compliance

**Must NOT do:**
- Do NOT add `min-h-[44px]` or `min-w-[44px]` to Switch (per `switch-component-styling.md`)
- Do NOT change the Switch dimensions (`h-6 w-11` root, `h-5 w-5` thumb)
- Do NOT add `rtl:flex-row-reverse` anywhere (per `rtl-support-arabic.md` — native `dir="rtl"` handles flex direction)
- Do NOT use `transition-all` or `duration-300` (per `uncodixify-ui.md`)

**Must DO:**
- Use Tailwind's built-in `rtl:` variant (no custom plugin needed)
- Keep `transition-transform duration-150` (already correct)

### Tests

**File:** `admin-frontend/src/components/ui/__tests__/switch.test.tsx` — extend existing tests

Add the following test cases:

1. **RTL: thumb has negative translate when checked**
   ```tsx
   it('applies RTL translate class to thumb when checked', () => {
     render(
       <div dir="rtl">
         <Switch checked={true} />
       </div>
     );
     const thumb = screen.getByRole('switch').querySelector('span');
     expect(thumb?.className).toContain('rtl:data-[state=checked]:-translate-x-5');
   });
   ```

2. **LTR: thumb has positive translate when checked (no regression)**
   ```tsx
   it('applies LTR translate class to thumb when checked', () => {
     render(<Switch checked={true} />);
     const thumb = screen.getByRole('switch').querySelector('span');
     expect(thumb?.className).toContain('data-[state=checked]:translate-x-5');
   });
   ```

3. **Unchecked: translate-x-0 in both directions**
   ```tsx
   it('applies translate-x-0 to thumb when unchecked', () => {
     render(<Switch checked={false} />);
     const thumb = screen.getByRole('switch').querySelector('span');
     expect(thumb?.className).toContain('data-[state=unchecked]:translate-x-0');
   });
   ```

**Create new test file:** `frontend/src/components/ui/__tests__/switch.test.tsx` — mirror the admin-frontend tests (frontend currently has no Switch tests).

**Extend:** `frontend/src/components/__tests__/NotificationPreferences.test.tsx` (create if not exists):

4. **RTL: custom switch thumb has negative translate when enabled**
5. **LTR: custom switch thumb has positive translate when enabled**
6. **RTL: custom switch thumb has negative translate when disabled**

### i18n

No new translation keys needed. This is a CSS-only fix.

### Documentation

No documentation changes needed. The fix is self-evident from the code.

### Verification

1. Switch language to Arabic in the frontend app settings
2. Navigate to any page with a Switch component (e.g., Settings > Notifications, or Admin > AI Providers)
3. Toggle the switch ON — thumb should slide LEFT (toward the start of the track in RTL)
4. Toggle the switch OFF — thumb should slide RIGHT (back to the end of the track in RTL)
5. Switch language back to English and verify the switch still works correctly (thumb slides RIGHT when ON)
6. Run all tests: `make shell-client npm test` and `make shell-admin npm test`
