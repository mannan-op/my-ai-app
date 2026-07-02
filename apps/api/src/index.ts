import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT ?? 4000);

app.use(cors());
app.use(express.json());

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

app.get("/health", async (_req, res) => {
  try {
    const dbResult = await pool.query("select 1 as ok");

    res.json({
      service: "api",
      status: "ok",
      database: dbResult.rows[0].ok === 1 ? "ok" : "unknown"
    });
  } catch (error) {
    res.status(500).json({
      service: "api",
      status: "error",
      database: "error"
    });
  }
});

app.get("/", (_req, res) => {
  res.json({
    message: "Node API is running"
  });
});

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});