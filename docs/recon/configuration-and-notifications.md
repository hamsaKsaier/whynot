# Recon — Configuration & notifications

The Recon **Settings → Recon** tab lets a workspace owner control who gets
emailed about scans and how much a single scan can spend. Scheduled scans are
reserved for a future release.

This page is only visible when the `recon_enabled` feature flag is enabled for
your workspace.

## Notifications

| Setting | Meaning |
|---------|---------|
| Email me on every scan completion | When ON, the chosen recipients receive an email each time a scan finishes successfully. |
| Email me when a scan fails | When ON, the chosen recipients receive an email whenever a scan ends in the `failed` state. |
| Recipients | The workspace members who receive both notification types. Empty = nobody is emailed. Recipients are chosen from your workspace's current members. |

Recipients are stored as workspace-member IDs. Removing a member from the
workspace automatically stops them receiving Recon emails — no cleanup
required.

## PAYG cap (max credits per scan)

| Value | Effect |
|-------|--------|
| `0` | No workspace-level cap — the platform default applies. |
| `1` to `100000` | Hard cap for a single scan. Scans that would exceed the cap are terminated before the next paid phase starts. |

The value is validated on both the client and the server:

- Must be a non-negative integer.
- Must be ≤ 100,000 credits.

Lower caps are a safety net for experimentation; higher caps are useful when
you want a long end-to-end run on a large target. The cap never raises your
billing — it only lowers it.

## Default schedule (coming soon)

The "Default schedule" card is rendered as disabled. Recurring scans are gated
behind a future flag and are not yet available.

## API

`GET /api/recon/settings`

```json
{
  "success": true,
  "settings": {
    "workspaceId": "…",
    "notifyRecipientUserIds": ["…"],
    "emailOnComplete": true,
    "emailOnFail": true,
    "paygCapCredits": 0
  }
}
```

`PUT /api/recon/settings`

```json
{
  "notify_recipient_user_ids": ["user-id-1", "user-id-2"],
  "email_on_complete": true,
  "email_on_fail": true,
  "payg_cap_credits": 5000
}
```

Both endpoints are workspace-scoped and gated by the `recon_enabled` feature
flag. A user without access to the workspace receives a `404`.

## Related safety rules

- Per-scan legal authorization is always required, independent of these
  settings (see the Recon authorization flow documentation).
- Production-environment warning rendering in the new-scan wizard and
  scan-detail page is not controlled by this tab — it's always on when the
  target environment is tagged `production`.
