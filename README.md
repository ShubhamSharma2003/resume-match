# Resumatch

A web app that keeps one master Overleaf/LaTeX résumé and tailors its wording to each pasted job description through your OpenAI API connection. It provides an explainable ATS-fit estimate, change review, LaTeX editing, compiled PDF preview, and PDF download.

## Run locally

1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:5173`.

PDF preview/download requires `tectonic` or `pdflatex` on the host. The Docker image includes pdfLaTeX:

```sh
docker build -t resumatch .
docker run --rm -p 8787:8787 --env-file .env -v resumatch-data:/app/.resume-data resumatch
```

Then open `http://localhost:8787`.

## Deploying to Vercel

`vercel.json` and `api/index.js` run the Express app as a serverless function, and `vercel.json` rewrites every `/api/*` request to it. Deploying the front end alone leaves nothing behind `/api`, so Vercel answers with its own 404 page and the app reports that it cannot reach the API.

Set these in **Project Settings → Environment Variables**, then redeploy:

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | Tailoring returns 503 without it. |
| `OPENAI_MODEL` | no | Defaults to `gpt-5.4-mini`. |

> **The app has no authentication.** Anyone who reaches the URL can tailor résumés against your `OPENAI_API_KEY`. On a public deployment, restrict access at the platform — Vercel's **Deployment Protection** (Settings → Deployment Protection) puts Vercel Authentication or a shared password in front of the whole project, `/api` included.

Two things work differently on a serverless host, and the app adapts on its own:

- **The master résumé is stored in your browser.** Serverless filesystems are read-only, so saving reports `storage: "browser"` and the client keeps the LaTeX in `localStorage`, sending it with each tailor request.
- **There is no PDF preview or download.** Compilation needs a LaTeX binary, which a serverless function cannot ship. The result panel offers *Copy LaTeX for Overleaf* instead.

## Deploying with a persistent server

For on-disk résumé storage and in-app PDF preview, run the Node server as a long-lived process — a container host, a VM, or anything that runs the Dockerfile. Build with `npm run build` and serve with `NODE_ENV=production npm start`, which serves the API and the front end from one port.

## Product guardrails

- The model is instructed to preserve LaTeX packages, macros, layout, spacing, sections, and contact details.
- Rewriting must remain supported by the original résumé; absent JD skills are shown as gaps rather than added as claims.
- The displayed score is a transparent weighted estimate: 45% keyword coverage, 40% core requirement coverage, and 15% parse-friendly structure. It is not an employer ATS score.
- LaTeX runs with shell escape disabled. The app itself is unauthenticated and single-tenant: for a public multi-user deployment, add authentication, per-user storage, rate limiting, and stronger process/container isolation.

The app uses the OpenAI Responses API with Structured Outputs, following the [official OpenAI documentation](https://developers.openai.com/api/docs/guides/structured-outputs).
