# Final PDF integrity

Newly issued PDFs contain visible Arabic integrity and automated-editing notices, a version-specific QR instruction, repeated reference watermarks, and the same snapshot-bound reference in the header, verification box and footer. There are no hidden prompts or invisible instructions. Security does not depend on an editor or AI following these notices.

The PDF Info dictionary and XMP record the Arabic title, Final status, document reference, verification ID, version, IntegrityProtected=true and IssueNewVersion policy. Metadata contains no phone number, password or secret. These fields describe registered-master verification; they are not a cryptographic PDF signature.

## Two fingerprints

The PDF displays a short fingerprint of its immutable snapshot, explicitly labelled as a data fingerprint. Its final byte-level SHA-256 is calculated after rendering and any configured signing, then recorded separately. The verification page shows the full and abbreviated final-file hash. A final file cannot contain its own hash without changing that hash. The visible notice directs readers to QR verification for the final-file fingerprint.

## Original-file verification and correction

The QR resolves to the specific document version. Upload verification compares the complete uploaded file SHA-256 with that version's registered master hash. A modified PDF can retain its reference and metadata but fails this comparison. The upload endpoint records verification events and cannot replace the original document. Original download returns the stored master bytes after validating their SHA-256; it never regenerates the PDF.

The verification page reports master availability, the actual version and registry status, and provides an original-master download when available. Registry presence alone does not establish that a user's local file matches; upload verification is required.

Existing immutable snapshots, unique reference/version constraints, conditional R2 writes, generation jobs and audit records remain in place. Legitimate corrections issue a new version through the existing correction flow. Existing masters stay unchanged: the new visual layer applies to newly issued documents and new versions, not by rewriting historical PDFs.

## Digital signatures

No digitally-signed claim is added by this renderer. A future PAdES integration must verify a real cryptographic PDF signature before adding such a claim; an environment flag or metadata status alone is insufficient.

## Isolated checks

`tests/pdf-layout.mjs` requires NODE_ENV=test and BLONTIX_ISOLATED_QA=1 and runs with `--import ./tests/support/register.mjs`. It creates one synthetic PDF, checks snapshot/reference binding and metadata, and exercises the real verification and master-download handlers with an in-memory database and storage fixture. A valid edited PDF keeps its reference but receives the explicit mismatch result. No live PostgreSQL or R2 resources are used. `scripts/qa-pdf-visual.mjs` accepts the sample through QA_PDF for layout checks.
