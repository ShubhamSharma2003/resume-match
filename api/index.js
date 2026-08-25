// Vercel serverless entry point. vercel.json rewrites every /api/* request here, and
// Vercel calls the exported Express app with the original request path intact.
export { default } from '../server/app.js';
