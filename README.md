# LendSync by OrderSphere

A static duplication of the supplied Netlify-hosted loan management application. The app provides dashboards, borrower and loan tracking, payment collection, schedules, reports, and settings in a responsive single-page interface.

## Technologies

- Semantic HTML, CSS, and vanilla JavaScript
- Browser `localStorage` for on-device application data
- Netlify Function for server-side Admin credential validation
- Google Fonts for the original typography
- Netlify static hosting

## Admin authentication

Configure `ADMIN_USERNAME` and `ADMIN_PASSWORD` in the Netlify environment before deploying or running with Netlify Dev. The Admin password is validated only by the server-side function and is never included in the browser source.

## Run locally

Serve the project root with any static file server, then open the local URL in a browser. For Netlify-compatible local serving, run:

```bash
netlify dev --port 8889
```

No package installation or build step is required. Admin login requires Netlify Dev rather than a basic static file server.
