## Pending security hardening (Phase 1.2 follow-ups)

- **Server-side MIME sniff**: Validate file type via magic bytes to complement client extension checks.
- **Antivirus/quarantine for PDFs**: Queue uploads for scan; move to `corpora` only after passing.
- **Rate-limit /api/uploads/sign**: Prevent link spraying and abuse.
- **Hash & dedupe**: Compute content hash for large files; consider per-user storage quota.
- **Audit log**: Record who signed which path and when; store redacted URLs only.
- **Kill switch for links**: Deleting an object immediately invalidates outstanding links; consider an admin UI to revoke links.
