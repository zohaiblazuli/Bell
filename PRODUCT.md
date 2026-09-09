# Product

<!-- impeccable:product-schema 1 -->

## Platform

Windows desktop (Tauri 2 with a React webview)

## Users

Bell serves Cambridge International students studying A Level, IGCSE, and O Level subjects on Windows. Students use it to find, download, read, annotate, and revisit exam material without depending on a continuous internet connection. A single, manually provisioned administrator curates the Community Resources catalogue; ordinary users do not have accounts and cannot upload resources.

## Product Purpose

Bell is a calm, offline-first desktop study environment for Cambridge past papers and trusted supporting material. It brings catalogue discovery, local PDF ownership, annotation, notebooks, timing, and progress tracking into one focused workspace. The Community Resources feature extends that purpose with an administrator-approved collection of notes and study resources that students can search, filter, preview, download, read, and upvote.

## Positioning

Bell treats study PDFs as durable local materials rather than transient web content: students choose what to keep, then read and annotate it in a purpose-built workspace that continues to function offline.

## Operating Context

Students browse by qualification and subject, download PDFs to their own machine, and work in an in-app PDF reader with page navigation, zoom, annotations, focus timing, and related study tools. Community browsing requires connectivity, while downloaded community PDFs should remain available locally. The administrator needs a private moderation and publishing workspace with catalogue statistics, PDF inspection, metadata editing, and security information.

## Capabilities and Constraints

- The desktop shell is Tauri 2 with React 19 and TypeScript; Rust owns HTTP, downloads, local files, and SQLite-backed catalogue data.
- The frontend webview remains network-isolated. New hosted-service calls must pass through typed Tauri commands implemented in Rust.
- Community Resources accepts PDF files only, up to 200 MB each.
- Only one manually provisioned administrator account exists initially. Public registration and ordinary-user accounts do not exist.
- Only the administrator may upload, publish, edit, unpublish, or remove resources.
- Ordinary users may browse, search, filter, preview, download, view, and upvote published resources.
- Published metadata includes the resource title, qualification, subject, resource type, description, author or organization when applicable, uploader identity, file facts, popularity, and publication date.
- Upvotes use a locally generated installation identifier plus server-side abuse controls; they are not equivalent to authenticated votes and must not be presented as tamper-proof.
- Uploader IP addresses are private security data. They are never returned to ordinary clients, are visible only in the protected administrator security view, are access-logged, and are retained for 30 days.
- Community files require server-side validation and malware scanning before publication, even when uploaded by the administrator.

## Brand Commitments

The product name is Bell. Its established visual identity uses a calm OS-glass desktop shell, restrained blue live accents, opaque content surfaces, bright white document pages, and selectable Azure or Mr. Bell mascots. Community Resources extends this system without introducing a separate visual identity or social-media aesthetic.

## Evidence on Hand

- The existing catalogue, local download pipeline, PDF.js reader, annotation canvas, focus timer, and local study-state systems are implemented in the repository.
- Existing visual tokens and reusable components live under `src/styles` and `src/ui`.
- No hosted identity, community database, object storage, moderation service, malware scanner, or production community content currently exists.
- No claims about resource volume, contributor count, moderation speed, or popularity should be invented before real data exists.

## Product Principles

- Trust is earned before reach: nothing appears publicly until it is validated, scanned, and deliberately published.
- Reading remains local-first: online discovery should lead to a durable local PDF that works in Bell's existing reader.
- Community signals assist judgment rather than replace it: popularity and upvotes are supporting metadata, not endorsements of academic accuracy.
- Administration is explicit and auditable: privileged actions, security-data access, and publication changes leave an audit trail.
- The feature stays study-focused: no profiles, comments, follower mechanics, public posting, or engagement loops are introduced.

## Accessibility & Inclusion

Community discovery, voting, download, reader, and administration workflows must be fully keyboard operable, expose meaningful focus and status states, preserve readable contrast in Day and Night tones, respect reduced motion, and avoid relying on thumbnails or colour alone to communicate document type or moderation status.
