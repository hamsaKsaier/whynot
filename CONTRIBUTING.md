# Contributing to WhyNot

Thanks for your interest in contributing! WhyNot is an open-source, self-hostable AI QA platform licensed under the [GNU AGPL-3.0](LICENSE).

## Licensing of contributions

By contributing to this repository you agree that your contributions are licensed under the AGPL-3.0, the same license as the project.

### Developer Certificate of Origin (DCO)

Every commit must be signed off, certifying that you wrote the code or otherwise have the right to submit it under the project license, per the [Developer Certificate of Origin 1.1](https://developercertificate.org/):

```bash
git commit -s -m "your commit message"
```

This adds a `Signed-off-by: Your Name <your@email.com>` line to the commit message. Pull requests with unsigned commits cannot be merged.

## How to contribute

1. **Open an issue first** for anything beyond a trivial fix — bug reports, feature ideas, model-compatibility reports. This avoids wasted work on changes that don't fit the roadmap.
2. **Fork and branch** from `main`.
3. **Keep PRs focused** — one change per PR.
4. **Run the checks** before pushing (all development happens through Docker):

   ```bash
   make shell-client npm run typecheck
   make shell-client npm run lint
   make shell-client npm test
   ```

5. **Sign off your commits** (`git commit -s`).

## Reporting model compatibility

WhyNot is bring-your-own-key and works with any provider configured in the admin panel. If you've run it with a model we haven't officially tested, please open an issue titled `[model-report] <provider>/<model>` describing what worked and what didn't — these reports drive the compatibility table in the README.

## Reporting security issues

Please do **not** open public issues for security vulnerabilities. Email the maintainer instead (see the repository profile), and we'll respond as quickly as possible.

## Code style

- TypeScript strict mode — no `any`.
- UI follows the project style rules in `.claude/rules/` (RTL support via logical properties, Shadcn semantic tokens, no decorative animations).
- Match the surrounding code's conventions; when in doubt, look at how the neighboring module does it.
