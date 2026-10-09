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
