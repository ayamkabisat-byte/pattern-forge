# Security Policy

PatternForge handles user-supplied SVG and saved pattern data in the browser, so input parsing and export paths should be treated as security-sensitive surfaces.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for a vulnerability that could enable script execution, unsafe SVG behavior, data exposure, malicious project import, or another exploitable condition.

Use GitHub's private vulnerability reporting / Security Advisory workflow for this repository when available. Include:

- a concise description of the issue;
- affected workspace or file path;
- reproduction steps or a minimal proof of concept;
- expected versus actual behavior;
- the potential security impact;
- any mitigation you have already tested.

If private vulnerability reporting is unavailable, contact the repository owner privately through the contact method listed on the maintainer's GitHub profile rather than publishing exploit details.

## Scope priorities

Security reports are especially useful for:

- SVG sanitization bypasses;
- unsafe embedded markup or event handlers;
- malformed / oversized project import handling;
- persistence of untrusted data in local browser storage;
- export paths that reintroduce sanitized content;
- dependency vulnerabilities with a practical impact on the deployed application.

## Disclosure

Please allow reasonable time for investigation and a fix before public disclosure. Once the issue is resolved, a public note can document the affected versions and remediation without exposing users to an unpatched exploit.
