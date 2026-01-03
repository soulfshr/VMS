# Security Policy

## Supported Versions

RippleVMS is continuously deployed. Only the latest version running in production is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| Latest (main branch) | :white_check_mark: |
| Previous deployments | :x: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email us at: **josh@honeybadgerapps.com**

Include the following in your report:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
- **Assessment**: We will investigate and assess the vulnerability within 7 days.
- **Resolution**: Critical vulnerabilities will be prioritized and patched as quickly as possible.
- **Disclosure**: We will coordinate with you on public disclosure timing after a fix is deployed.

### Scope

The following are in scope for security reports:
- Authentication and authorization bypasses
- Data exposure or leakage
- Cross-site scripting (XSS)
- SQL injection
- Cross-site request forgery (CSRF)
- Server-side request forgery (SSRF)
- Remote code execution
- Privilege escalation

The following are out of scope:
- Denial of service attacks
- Social engineering attacks
- Physical security issues
- Issues in third-party dependencies (report these to the respective maintainers)

## Security Practices

For information about our security practices, data handling, and architecture, see our [Security & Architecture](https://ripple-vms.com/about/security) page.

Key practices include:
- HTTPS/TLS encryption for all traffic
- Passwords hashed with bcrypt
- Role-based access control
- Database encryption at rest and in transit
- IP addresses hashed before storage
- Regular dependency updates
- SOC 2 compliant infrastructure providers

## Acknowledgments

We appreciate security researchers who help keep RippleVMS and our volunteers safe. Reporters of valid vulnerabilities will be acknowledged (with permission) in our release notes.
