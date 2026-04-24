---
title: "Recon — CI integration"
description: "Trigger Recon scans from your CI pipeline. Coming soon."
lang: en
draft: false
---

# CI integration

> **Coming soon.** CI-triggered scans are on the roadmap. The shape of the integration is described below; the API is not yet stable.

The goal of CI integration is to let you run a Recon scan automatically when a deployment lands in a non-production environment, then surface findings on the pull request that triggered the deployment.

---

## Planned shape

A typical workflow:

1. Your CI pipeline deploys a build to a staging or preview environment.
2. The pipeline calls a Recon webhook with the environment URL, the commit SHA, and a per-run authorization token.
3. Recon launches a scan, scoped to the environment URL.
4. When the scan finishes, Recon posts a summary back to the pull request: severity counts, a diff against the previous scan, and a link to the full report.
5. If a Critical or High finding is introduced (i.e. it was not present in the previous scan), the CI check fails. Existing findings do not block.

Authorization is per-run, not per-pipeline: the CI token represents a workspace owner who has pre-authorized scans against a specific allow-list of environment URLs. Scans against any other URL require a fresh, interactive authorization through the wizard.

## Why this isn't shipped yet

CI integration multiplies the surface area of the per-scan authorization gate, and getting that wrong would undermine the whole responsible-use story. We're working through:

- How a CI token can attest to authorization without being a long-lived secret in your CI provider.
- How to handle deploy previews where the URL changes per pull request.
- How to safely fail-closed when the CI provider doesn't support gating on a check status.

We'd rather ship this once than ship it twice.

## Be a beta tester

If you want early access, sign up below. We'll reach out when the API is stable enough to commit to.

> **Beta sign-up:** Email `recon-beta@` your workspace domain, or open the Recon → Settings → CI panel and click **Join the CI beta waitlist**.

We'll prioritize teams that:

- Already deploy to ephemeral preview environments per pull request.
- Have an internal security or platform team who can review the integration.
- Are willing to give weekly feedback during the beta.

## In the meantime

- Use the [Quickstart](quickstart.md) to launch scans manually after big deploys.
- Use the [report shareable link](reading-reports.md#sharing-a-report) to send results to engineers without giving them workspace access.
- Use the [per-scan credit cap](quotas.md#per-scan-credit-cap) to control cost on busy weeks.

---

Related:

- [Quickstart](quickstart.md)
- [Responsible use](responsible-use.md)
- [Reading reports](reading-reports.md)
