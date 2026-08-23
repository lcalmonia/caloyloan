# Project Guide

## Architecture

This is a build-free static single-page application. The complete user interface, styles, state management, and application behavior live in `index.html`. Netlify serves the repository root according to `netlify.toml`.

## Key Files

- `index.html`: Application markup, CSS, JavaScript, seeded demo data, and browser persistence.
- `netlify.toml`: Static publish configuration and response headers.
- `README.md`: Project overview and local usage instructions.

## Conventions

- Keep the project dependency-free unless a requested feature clearly requires otherwise.
- Preserve the single-file structure when making small visual or behavioral changes.
- Use existing CSS variables and component classes before adding new styles.
- Keep persisted data compatible with the current `localStorage` schema and key.
- Maintain responsive behavior for desktop and mobile layouts.

## Non-Obvious Decisions

Application records remain in each visitor's browser because the duplicated source uses `localStorage`; there is no shared server-side database. External network usage is limited to font loading and the configured Messenger link.
