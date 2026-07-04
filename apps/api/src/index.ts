import express from "express";
import cors from "cors";
import multer from "multer";
import { agentRouter } from "./agentRoutes.js";
import { ensureDatabaseSchema, pool } from "./db.js";
import { documentRouter } from "./documentRoutes.js";
import { retrievalRouter } from "./retrievalRoutes.js";

const app = express();
const port = Number(process.env.API_PORT ?? 4000);

app.use(cors());
app.use(express.json());
app.use("/agent", agentRouter);
app.use("/documents", documentRouter);
app.use("/retrieval", retrievalRouter);

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

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    res.status(400).json({
      error: "upload_error",
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Uploaded PDF must be 50 MB or smaller."
          : "The file upload could not be processed."
    });
    return;
  }

  res.status(500).json({
    error: "internal_server_error",
    message: "An unexpected error occurred."
  });
});

await ensureDatabaseSchema();

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
