import app from './app.js';

const PORT = Number(process.env.PORT || 8787);

app.listen(PORT, () => console.log(`Resumatch server listening on http://localhost:${PORT}`));
