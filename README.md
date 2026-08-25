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

## Deploying

Resumatch is a Node server plus a built front end, so it needs a host that runs `server/index.js` — a container host, a VM, or any platform that runs the Dockerfile. Build with `npm run build` and serve with `NODE_ENV=production npm start`.

A static-only host (Vercel, Netlify, GitHub Pages, S3) will serve the interface but has nothing behind `/api`, so it returns its own 404 page instead of JSON and the password screen reports that it cannot reach the API. The Express server also holds session tokens in memory and stores the master résumé on disk, and PDF preview shells out to a LaTeX engine, so a single long-lived process is the right deployment shape rather than serverless functions.

## Product guardrails

- The model is instructed to preserve LaTeX packages, macros, layout, spacing, sections, and contact details.
- Rewriting must remain supported by the original résumé; absent JD skills are shown as gaps rather than added as claims.
- The displayed score is a transparent weighted estimate: 45% keyword coverage, 40% core requirement coverage, and 15% parse-friendly structure. It is not an employer ATS score.
- LaTeX runs with shell escape disabled. For a public multi-user deployment, add authentication, per-user storage, rate limiting, and stronger process/container isolation.

The app uses the OpenAI Responses API with Structured Outputs, following the [official OpenAI documentation](https://developers.openai.com/api/docs/guides/structured-outputs).
