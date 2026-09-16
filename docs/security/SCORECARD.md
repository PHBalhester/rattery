# OpenSSF Scorecard assessment

Date: 2026-09-16. Tool: official OpenSSF Scorecard v5.5.0.
Repository: PHBalhester/rattery, private.
Assessed commit: d73621b9cc3c07fc49aeae442d3b9f491572c95d.

**Overall result: 5.4/10.** This is the tool's security-practice score, not a code-quality grade, certification, penetration test or guarantee of safety. The private repository was scanned locally with authenticated GitHub access. Results were not submitted to the public OpenSSF dashboard.

The official Linux binary was downloaded from ossf/scorecard and checked against its GitHub release SHA-256:
83b90a05c1540ef1390db1cd5711e5fd04be9c1d8537fb84d39d02092d6a8dff

[Raw machine-readable result](scorecard-2026-09-16.json)

## Findings

| Check | Score | Tool explanation |
| --- | --- | --- |
| Binary-Artifacts | 10/10 | no binaries found in the repo |
| Branch-Protection | 0/10 | branch protection not enabled on development/release branches |
| CI-Tests | Not evaluated | no pull request found |
| CII-Best-Practices | 0/10 | no effort to earn an OpenSSF best practices badge detected |
| Code-Review | 0/10 | Found 0/2 approved changesets -- score normalized to 0 |
| Contributors | 0/10 | project has 0 contributing companies or organizations -- score normalized to 0 |
| Dangerous-Workflow | 10/10 | no dangerous workflow patterns detected |
| Dependency-Update-Tool | 10/10 | update tool detected |
| Fuzzing | 0/10 | project is not fuzzed |
| License | 9/10 | license file detected |
| Maintained | 0/10 | project was created within the last 90 days. Please review its contents carefully |
| Packaging | Not evaluated | packaging workflow not detected |
| Pinned-Dependencies | 10/10 | all dependencies are pinned |
| SAST | 0/10 | no SAST tool detected |
| Security-Policy | 3/10 | security policy file detected |
| Signed-Releases | Not evaluated | no releases found |
| Token-Permissions | 10/10 | GitHub workflow tokens follow principle of least privilege |
| Vulnerabilities | 10/10 | 0 existing vulnerabilities detected |

## Interpretation and priorities

1. **Branch protection:** a real governance gap. GitHub rejected enforcement for this private repository under the current plan. Enable it when the account/repository supports it, require passing CI, block force pushes/deletion and use reviewed changes. Do not make the repository public solely to improve this score.
2. **Code review:** initial commits were direct pushes; no independent review evidence exists. Use pull requests and meaningful human review for future changes. Never fabricate approvals or contributors.
3. **SAST:** add a suitable static security analyzer. Existing Gitleaks and npm audit cover secrets and known dependency advisories; they are not application-level SAST. Evaluate local Semgrep or GitHub CodeQL subject to private-repository licensing before enabling a service.
4. **Security policy:** define an operational private contact route and realistic triage expectations with the maintainer. The current file exists but the scanner found weak disclosure/timeline signals. Do not invent an email address or response SLA.
5. **Fuzzing:** add generated malformed input coverage for receipt parsing, replay/snapshots and API input. Existing stress/adversarial suites are useful but not detected fuzzing integration.
6. **History and contributors:** the project is new. Maintenance age and independent contribution evidence must accumulate naturally; do not manufacture activity.
7. **License:** a rights notice exists but is not an OSI/FSF license. This is an owner decision, not a defect to fix by granting rights without authorization.
8. **Releases/packaging:** currently unassessed. The app has no published packages/releases. Add signed release provenance if a real release process is adopted, rather than publishing empty releases for points.

## Important limitations

CI-Tests was **not evaluated**, not failed: Scorecard reported no qualifying pull request history. The main-branch CI has already passed. SAST also notes the absence of merged pull requests; it does not establish that the entire application has been analyzed.

Vulnerabilities=10 means the tool detected no existing vulnerabilities within this check's coverage at scan time. It does not establish that the mint/payment implementation is production-ready. docs/RELEASE.md remains authoritative for release blockers.

A low age/contributor score is not proof of malicious code; a high score would not prove the opposite. Report the full dated result and scope. Do not display a misleading certification badge or claim an independent audit.

## Reproduce

On Linux x64, with gh authenticated to an account authorized to read this repository:

```sh
python3 scripts/run-scorecard.py
```

The script downloads the checksum-pinned official binary, reads the existing gh credential into the scanner process environment (never prints or writes it), and saves results under ignored test-results/scorecard/. It does not change repository settings, upload source to a code-scanning SaaS, or publish a badge. Scorecard queries GitHub and public security-metadata services; it is not an air-gapped scan.

References:
- [Official project and scoring/check documentation](https://github.com/ossf/scorecard)
- [OpenSSF Scorecard](https://securityscorecards.dev/)
