import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  normalizeEvent,
  ValidationError,
} from "./validation.js";

import {
  ReconciliationEngine,
} from "./reconciler.js";

import {
  replayEvents,
  ReplayError,
} from "./replay.js";

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  dirname(__filename);

const PORT =
  Number(process.env.PORT ?? 3000);

const auditPath = join(
  __dirname,
  "..",
  "audit",
  "audit.jsonl",
);

const engine =
  new ReconciliationEngine(
    auditPath,
  );

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.statusCode =
    statusCode;

  response.setHeader(
    "Content-Type",
    "application/json",
  );

  response.end(
    JSON.stringify(
      body,
      (_, value) =>
        typeof value === "bigint"
          ? value.toString()
          : value,
    ),
  );
}

async function readBody(
  request: import("node:http").IncomingMessage,
): Promise<string> {
  const chunks: Buffer[] = [];

  for await (
    const chunk of request
  ) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk),
    );
  }

  return Buffer.concat(
    chunks,
  ).toString("utf8");
}

async function handleRequest(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
): Promise<void> {
  const method =
    request.method ?? "GET";

  const url =
    new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );

  /*
   * ---------------------------------------------
   * GET /health
   * ---------------------------------------------
   */

  if (
    method === "GET" &&
    url.pathname === "/health"
  ) {
    sendJson(
      response,
      200,
      {
        status: "ok",
        service:
          "cross-chain-liquidity-reconciliation-engine",
      },
    );

    return;
  }

  /*
   * ---------------------------------------------
   * GET /state
   * ---------------------------------------------
   */

  if (
    method === "GET" &&
    url.pathname === "/state"
  ) {
    sendJson(
      response,
      200,
      engine.snapshot(),
    );

    return;
  }

  /*
   * ---------------------------------------------
   * GET /audit
   * ---------------------------------------------
   */

  if (
    method === "GET" &&
    url.pathname === "/audit"
  ) {
    sendJson(
      response,
      200,
      {
        audit:
          engine.auditEntries(),
      },
    );

    return;
  }

  /*
   * ---------------------------------------------
   * POST /events
   * ---------------------------------------------
   */

  if (
    method === "POST" &&
    url.pathname === "/events"
  ) {
    let body: unknown;

    try {
      const rawBody =
        await readBody(
          request,
        );

      if (
        rawBody.trim() === ""
      ) {
        throw new ValidationError(
          "Request body cannot be empty",
        );
      }

      body =
        JSON.parse(
          rawBody,
        );
    } catch (error) {
      sendJson(
        response,
        400,
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid JSON body",
        },
      );

      return;
    }

    try {
      const event =
        normalizeEvent(
          body as Record<
            string,
            unknown
          >,
        );

      const result =
        engine.process(
          event,
        );

      sendJson(
        response,
        result.statusCode,
        {
          event_id:
            result.event_id,
          decision:
            result.decision,
          reason:
            result.reason,
          state:
            result.state,
          audit:
            result.audit,
        },
      );

      return;
    } catch (error) {
      sendJson(
        response,
        400,
        {
          error:
            error instanceof Error
              ? error.message
              : "Malformed event",
        },
      );

      return;
    }
  }

    /*
   * ---------------------------------------------
   * POST /replay
   * ---------------------------------------------
   */

  if (
    method === "POST" &&
    url.pathname === "/replay"
  ) {
    let body: unknown;

    try {
      const rawBody =
        await readBody(request);

      if (
        rawBody.trim() === ""
      ) {
        throw new ReplayError(
          "Request body cannot be empty",
        );
      }

      body =
        JSON.parse(rawBody);
    } catch (error) {
      sendJson(
        response,
        400,
        {
          error:
            error instanceof Error
              ? error.message
              : "Invalid JSON body",
        },
      );

      return;
    }

    try {
      const result =
        replayEvents(
          engine,
          body,
        );

      sendJson(
        response,
        200,
        result,
      );

      return;
    } catch (error) {
      sendJson(
        response,
        400,
        {
          error:
            error instanceof Error
              ? error.message
              : "Replay failed",
        },
      );

      return;
    }
  }

  /*
   * ---------------------------------------------
   * Unknown route
   * ---------------------------------------------
   */

  sendJson(
    response,
    404,
    {
      error: "Not found",
    },
  );
}

const server =
  createServer(
    (request, response) => {
      handleRequest(
        request,
        response,
      ).catch(
        (error) => {
          console.error(
            "Unhandled request error:",
            error,
          );

          if (
            !response.headersSent
          ) {
            sendJson(
              response,
              500,
              {
                error:
                  "Internal server error",
              },
            );
          }
        },
      );
    },
  );

server.listen(
  PORT,
  () => {
    console.log(
      `Cross-Chain Liquidity Reconciliation Engine listening on http://localhost:${PORT}`,
    );
  },
);

function shutdown(): void {
  console.log(
    "\nShutting down...",
  );

  server.close(
    () => {
      process.exit(0);
    },
  );
}

process.on(
  "SIGINT",
  shutdown,
);

process.on(
  "SIGTERM",
  shutdown,
);