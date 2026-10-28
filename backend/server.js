require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cardsRouter = require("./routes/cards");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(helmet({
  // The app uses a small Supabase JS script from jsDelivr in index.html.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://*.supabase.co"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "flashcard-learning-app", timestamp: new Date().toISOString() });
});
app.use("/api/cards", cardsRouter);

app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.use((error, _req, res, _next) => {
  // Log technical details on the server, but do not expose them to the browser.
  console.error("Request failed:", error.message || error);
  if (res.headersSent) return;
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
  const message = status === 500
    ? "Something went wrong on the server. Check the backend terminal and Supabase settings."
    : error.message;
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Flashcard Learning App running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
