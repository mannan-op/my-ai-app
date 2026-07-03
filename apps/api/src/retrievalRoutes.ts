import express from "express";
import {
  InvalidRetrievalRequestError,
  parseRetrievalRequest,
  searchChunks
} from "./retrieval.js";

export const retrievalRouter = express.Router();

retrievalRouter.post("/search", async (req, res, next) => {
  try {
    const input = parseRetrievalRequest(req.body);
    const chunks = await searchChunks(input);

    res.json({ chunks });
  } catch (error) {
    if (error instanceof InvalidRetrievalRequestError) {
      res.status(400).json({
        error: "invalid_request",
        message: error.message
      });
      return;
    }

    next(error);
  }
});
