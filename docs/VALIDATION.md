# Repository preparation validation — 2026-09-16

Validated locally before the first remote publication:

- Clean indexed export: npm ci --ignore-scripts, production build, API typecheck and 18 controlled suites passed.
- Mock-wallet browser regression passed after portable test-runner changes.
- All CommonJS browser scripts passed syntax checking.
- Relative documentation links resolved.
- Publication checker rejected synthetic credential, local-path and environment-file fixtures, without printing secret values.
- Gitleaks 8.30.1, official binary verified against its pinned SHA-256: zero findings on the indexed export.
- npm dependency audit: zero known reported vulnerabilities at check time.
- Existing large JavaScript bundle warning remains.

Excluded: private environments, deployment metadata, archives, raw captures, local reports, .blend files and the unlicensed-for-redistribution soundtrack. Personal machine paths were removed from published browser tooling; the test-token preparer now requires an explicit test wallet environment setting.

These results are local evidence, not a third-party audit or proof of zero vulnerabilities. Financial services, physical devices and public deployment behavior remain release gates. CI results on GitHub are reported separately by the workflow.

## GitHub publication
Repository: https://github.com/PHBalhester/rattery (private).
Initial CI passed: https://github.com/PHBalhester/rattery/actions/runs/35104165546
This run includes the checksum-pinned Gitleaks scan, publication checker, build, API typecheck, 18 suites and dependency audit.

Dependency alerts enabled. Workflow default permissions are read-only and workflows cannot approve pull requests. Dependabot opens update proposals; no automatic merging is configured.

Branch protection was requested but rejected by GitHub: this account needs Pro for a private repository, or the repository must become public. Private vulnerability reporting also returned unavailable (404). Native secret protection availability was not confirmed for this private repository. Do not describe those features as enabled. Review them again before public launch; never make the repository public solely to bypass this limitation.
