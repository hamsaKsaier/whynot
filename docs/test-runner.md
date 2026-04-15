# Test Runner UI

## Overview

The test runner provides a real-time view of test execution with live browser preview, agent activity monitoring, and comprehensive results display.

## Layout

- **Desktop (lg:)**: Two-column grid — left panel shows QA Loop controls and agent activity, right panel shows live browser preview
- **Mobile**: Stacked layout — browser preview on top, controls below

## Controls

| Control | Action |
|---------|--------|
| Start Scan | Begin a new QA loop session |
| Pause | Pause the current execution |
| Resume | Resume a paused execution |
| Stop | Stop the execution and show results |
| Rerun | Rerun a completed test |
| Fullscreen | Toggle fullscreen browser preview |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Pause / Resume |
| `R` | Rerun test |
| `Escape` | Close detail dialog |
| `?` | Show keyboard shortcuts |
| `F` | Toggle fullscreen preview |

## Browser Preview

The browser preview streams live screenshots from the test execution via WebSocket. Features:
- Zoom controls (25%–200%)
- Browser selector (Chrome, Firefox, Safari, Edge)
- Resolution selector
- Frame-by-frame navigation with timeline scrubber
- Step-based navigation

## Results

After execution completes, the results view shows:
- **Summary**: Pass/fail counters, duration, assertion count
- **Step Results**: Table with status, duration, screenshots per step
- **Visual Regression**: Side-by-side comparison with diff highlighting
- **Trace Viewer**: Console, Network, DOM, and Actions tabs

## Agent Activity

The QA Loop agent board shows:
- Per-agent cards with status (idle, running, blocked, done)
- Real-time thinking/reasoning stream
- Tool call history with inputs and results
- Cost tracking and token usage

## Accessibility

- `aria-live="polite"` regions announce streaming events to screen readers
- All controls are keyboard-accessible
- Focus management for dialogs and modals
