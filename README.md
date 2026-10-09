# PortfolioWebsite

Website Portfolio using Bootstrap, HTML, CSS and JS.

www.josuearana.com

## Local preview

No dependency installation is required for the local preview. Run:

```sh
npm start
```

Then open http://localhost:3000. The preview supports the extensionless page URLs `/about`, `/software`, `/web`, and `/artwork`, while returning 404 responses for missing assets.

## Netlify deployment

This is a static multi-page site and does not require a build command. In the Netlify site settings, use:

- Build command: leave blank
- Publish directory: `.`
- Base directory: leave blank

If Netlify shows context-specific build settings, clear any override that runs `gulp build` or publishes `dist`. The repository `netlify.toml` contains the same root publish configuration and explicit routes for `/about`, `/web`, `/software`, and `/artwork`; trailing-slash variants redirect to the extensionless URLs. The Apache `.htaccess` file and `npm start`/`server.js` are not used by Netlify.

To redeploy, save those settings in Netlify and trigger a new deploy from the connected repository. Confirm the deploy log shows no build step and that the published directory is the repository root. Then check `/`, `/about`, `/web`, `/software`, and `/artwork` directly in the deployed site.

### Contact form production checklist

The contact form uses Netlify Forms with a native POST and does not submit through custom JavaScript. Localhost can display and validate the form, but it cannot process a Netlify submission or provide production reCAPTCHA verification.

After deploying, verify in the Netlify dashboard and on the live site:

1. Netlify detects the form named `contact`.
2. The reCAPTCHA widget appears and works in production.
3. A clearly labeled manual test submission appears in Netlify.
4. The post-submission confirmation behavior works as expected.
5. Notification delivery works if notifications are configured.

Do not treat an HTTP 200 response or successful browser validation as proof that Netlify received a submission. Form detection, spam protection, submission records, and notifications require production/dashboard verification.
