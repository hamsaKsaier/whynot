---
title: "Superadmin Access"
description: "The superadmin area is accessible at `https://superadmin.whynot.skrum.io`. It serves the same admin-frontend application but with a restricted navigat"
lang: en
draft: false
---

# Superadmin Access

## Overview

The superadmin area is accessible at `https://superadmin.whynot.skrum.io`. It serves the same admin-frontend application but with a restricted navigation scope and hostname-aware behavior.

## Who Has Access

Only users with the `super_admin` role can access the superadmin hostname. This is enforced at two levels:

1. **Authentication**: The login flow requires `super_admin` role. Non-superadmin users receive an "access denied" error.
2. **Hostname gating**: If a user somehow reaches `superadmin.whynot.skrum.io` without the `super_admin` role, they see a clear "Access Denied" page with a redirect to `admin.whynot.skrum.io`.

## Differences from admin.whynot.skrum.io

| Behavior | admin.whynot.skrum.io | superadmin.whynot.skrum.io |
|----------|----------------------|---------------------------|
| Sidebar sections | All sections | Platform, Billing, Flags & AI, Settings only |
| Post-login redirect | `/` (Dashboard) | `/users` |
| Sidebar title | "Admin" | "Super Admin" |
| Access denied flow | Generic forbidden page | Dedicated page with redirect to admin |

## How It Works

The admin-frontend detects the hostname via `window.location.hostname` using the helper at `src/lib/hostname.ts`. Based on the detected mode (`"admin"` or `"superadmin"`):

- **AdminShell** filters the sidebar navigation sections.
- **LoginPage** redirects to `/users` instead of `/` after successful login.
- **ProtectedRoute** shows `AccessDeniedPage` instead of `ForbiddenPage` for non-superadmin users on the superadmin hostname.

## Supported Hostnames

| Hostname | Mode |
|----------|------|
| `superadmin.whynot.skrum.io` | `superadmin` |
| `superadmin.localhost` | `superadmin` (dev) |
| Any other | `admin` |

## Adding the Superadmin Hostname

No separate SPA deployment is needed. The superadmin hostname is an Nginx alias pointing to the same `admin-frontend` upstream (port 5184). See [Nginx Setup](../../deployment/nginx-setup.md) for configuration details.

### DNS

Create an A/AAAA record for `superadmin.whynot.skrum.io` pointing to the same IP as `whynot.skrum.io`.

### CORS

The gateway must include `https://superadmin.whynot.skrum.io` in its CORS allowlist. Set `SUPERADMIN_FRONTEND_URL=https://superadmin.whynot.skrum.io` in the `.env` file.
