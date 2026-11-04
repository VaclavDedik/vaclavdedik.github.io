# Václav Pivoňka

Personal business card at [pivonka.dev](https://pivonka.dev/).

A responsive static website built with HTML and CSS. No build step, JavaScript, external fonts, or package dependencies.

## Local preview

```sh
python3 -m http.server 8000
```

Open [localhost:8000](http://localhost:8000).

## Deployment

GitHub Pages publishes the root of `master`. Keep `.nojekyll` to serve the site without Jekyll and `CNAME` to preserve the custom domain. Merge the changes into `master` to deploy.

## Editing

- `index.html`: profile, social links, metadata, and copyright year.
- `css/main.css`: theme, layout, and mobile breakpoints.
- `img/peony.webp`: original generated botanical illustration.
- `img/favicon.svg`: browser icon.
- `404.html`: fallback for missing pages, including retired article URLs.

The existing profile URLs intentionally retain the previous username.
