---
title: "Recon — Troubleshooting"
description: "Common failures when running Recon scans and how to fix them."
lang: en
draft: false
---

# Troubleshooting

This page covers the most common failure modes when launching or running a Recon scan, along with the cause and the fix. If you hit something not listed here, contact support and include the scan ID from the URL.

---

## I can't see Recon in the sidebar

**Cause.** The `recon_enabled` feature flag is off for your workspace.

**Fix.** Ask a workspace owner to enable Recon under **Settings → Feature flags**. If you are the owner and don't see the flag, your plan does not include Recon — see [Quotas](quotas.md).

## "Authorization is required" — 400 error when launching a scan

**Cause.** The new-scan request reached the gateway without a valid authorization block. This usually means one of the three confirmation checkboxes was not ticked, or the form was submitted before the legal-entity field was filled.

**Fix.**

1. Open the new-scan wizard again.
2. On the Authorization step, tick all three checkboxes:
   - "I am authorized to scan this target."
   - "I understand this scan will send active probes."
   - The legal entity you represent.
3. Re-submit.

If you still get the error, check the browser console for a request payload missing the `authorization` field — this can happen if a browser extension is rewriting form submissions.

## "Repository is not connected" warning in the wizard

**Cause.** You picked a target whose environment is associated with a git repository, but that repository is not currently connected to the workspace.

**Fix.** This is a warning, not a blocker. You can launch the scan without a connected repository — Recon will skip the source-aware analysis phase. To enable source-aware analysis:

1. Open **Settings → Integrations**.
2. Connect the repository (GitHub, GitLab, Bitbucket).
3. Re-launch the scan.

The included credit cost in the wizard is the same with or without a connected repository; the deeper signal just makes findings more accurate.

## "Environment URL is missing" when launching

**Cause.** The selected environment has no `base_url` set.

**Fix.** Open the environment under **Settings → Environments**, set a base URL (must be `https://` in most workspaces), save, then re-open the wizard.

## A scan is stuck in "running" for hours

**First, check the per-scan credit cap.** A scan that hits the cap is terminated cleanly and moves to the `terminated` state — it does not appear stuck. If the cap is `0`, this is not the cause.

**Second, check the phase indicator** on the scan-detail page. If the same phase is shown for more than an hour without progress, the scan is genuinely stuck.

**Fix.**

1. Click **Pause** on the scan-detail page.
2. Wait 30 seconds.
3. Click **Resume**. Note that resume requires the original target URL to byte-equal the resumed target URL — see [Responsible use](responsible-use.md#resume-requires-url-match).
4. If the scan does not resume successfully, click **Cancel** and launch a fresh scan. You will not be charged for incomplete phases.

If multiple scans get stuck on the same phase against the same target, the target may be rate-limiting Recon. Reduce the scope from Deep to Standard, or contact support.

## Resume failed with "URL mismatch"

**Cause.** The target URL changed between pause and resume. This is a deliberate safety check — see [Responsible use](responsible-use.md#resume-requires-url-match).

**Fix.** Launch a fresh scan with a new authorization block. Do not try to work around the URL check; it exists for a reason.

## A finding's proof-of-concept doesn't reproduce manually

**Possible causes.**

- The target's state changed between scan and your manual replay (a fix landed, a session expired, a feature flag flipped).
- The proof-of-concept depends on a session cookie or auth token that has since been rotated.
- The scan exploited a race condition that doesn't reliably reproduce.

**Fix.**

1. Re-scan the target. If the finding reappears, it's still live; if not, it was likely fixed.
2. If the finding reappears but you still cannot reproduce manually, inspect the **Coverage gaps** section of the report — the original probe may have used credentials you don't have.
3. If you suspect a real false positive, click **Report a false positive** on the finding card. The pipeline uses these to improve confidence scoring. See [Understanding findings — false-positive policy](understanding-findings.md#false-positive-policy).

## "Scan budget exceeded — workspace cap reached"

**Cause.** Your workspace has hit its monthly Recon scan or credit allowance, and PAYG billing is disabled (Free plan, or your billing contact has explicitly disabled overage).

**Fix.** Upgrade to a paid plan, enable PAYG, or wait until the next billing cycle. See [Quotas](quotas.md).

## A finding I expected to see is missing from the report

**Possible causes.**

- The finding had no reproducible proof-of-concept and was suppressed under the **no exploit, no report** policy. See [Understanding findings](understanding-findings.md#no-exploit-no-report).
- The finding was previously dismissed as `false_positive`, `accepted_risk`, `duplicate`, or `out_of_scope` and is suppressed from subsequent scans.
- The endpoint hosting the issue is in a coverage gap (auth required, WAF blocked, crawl budget exhausted). Check the **Coverage gaps** section of the report.

**Fix.** Open **Recon → Findings → All (including dismissed)** to see suppressed and dismissed findings. If a real issue is being suppressed, undismiss it on the finding card.

## "Production environment selected" warning is blocking my workflow

**This warning does not block.** It is an interstitial in the wizard. You can still launch the scan; the warning exists to make sure you really intended to scan production.

If you find the warning noisy because you scan production deliberately and frequently, we are open to adding a per-workspace "I always scan production, suppress this warning" toggle. Open a feature request.

## I need to delete a scan

Workspace owners can delete a scan from the scan-detail page (**More → Delete scan**). Deleting a scan removes:

- The scan row.
- The findings.
- The report.

Deleting a scan does **not** remove the authorization audit log row — those are immutable for the lifetime of the workspace.

## Still stuck?

- For platform-level issues (UI errors, sign-in problems): general [troubleshooting docs](../../TROUBLESHOOTING.md).
- For Recon-specific issues not covered here: contact support with the scan ID from the URL.

---

Related:

- [Quickstart](quickstart.md)
- [Responsible use](responsible-use.md)
- [Understanding findings](understanding-findings.md)
- [Reading reports](reading-reports.md)
- [Quotas and billing](quotas.md)
