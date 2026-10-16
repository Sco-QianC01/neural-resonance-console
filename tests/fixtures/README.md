# Public catalog fixture

`vmus-chopin-contents.json` preserves the anonymous public Vmus Chopin catalog
response retrieved on 2026-10-12. Its SHA256 is checked against
`public/research/vmus-reference-cases.json` before comparing all 40 media entries.
It contains catalog metadata, not audio, credentials, device data or local settings.
Tests use this tracked snapshot so clean GitHub checkouts work offline.
