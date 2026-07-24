# Portfolio Website

Personal portfolio for Rahul Sangamker, AI/ML Engineer. Built with Next.js (static export), deployed to GitHub Pages. 

**Live site:** https://rs-03.github.io

## Structure

```
app/                  # Next.js application
  src/app/            # Pages (home, /projects, /projects/[slug], /demos, 404, sitemap)
  src/components/     # Layout, sections, live demos, project cards, theme toggle
  src/data/           # All content: siteConfig.js, sectors.js, projects/*/config.js
  src/styles/         # Design tokens, themes (dark/light), components
articles/             # Technical article sources (published on dev.to)
scripts/              # Model training, DSP tests, publishing, resume generation
```

## Development

```bash
cd app
npm install
npm run dev      # http://localhost:3000
npm run build    # static export to app/out
npx eslint src   # lint
```

Verification: `node scripts/test_inference_parity.mjs` checks the in-browser
neural network against its Python training run; `node scripts/test_cough_dsp.mjs`
checks the hand-written FFT/MFCC pipeline against reference implementations.

## Adding a project

Create `app/src/data/projects/<category>/<slug>/config.js` (copy an existing one),
then register it in `app/src/data/projects/index.js`. Cards, filters, the detail
page, and the sitemap are all generated from that config.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the
static site and deploys it to GitHub Pages.

## Usage

The source is public so the site's claims can be verified, and you're welcome
to read it and borrow ideas. The code, content, case studies, and branding are
not licensed for reuse or republication.
