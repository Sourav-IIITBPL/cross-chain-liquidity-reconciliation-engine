import { resolve } from "node:path";

import {
  loadFixture,
} from "./fixtures.js";

import {
  normalizeEvent,
} from "./validation.js";

import {
  ReconciliationEngine,
} from "./reconciler.js";

async function main(): Promise<void> {
  const [
    command,
    fixturePath,
  ] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exit(1);
  }

  if (
    command !== "ingest" &&
    command !== "replay"
  ) {
    console.error(
      `Unknown command: ${command}`,
    );

    printUsage();

    process.exit(1);
  }

  if (!fixturePath) {
    console.error(
      "Fixture path is required.",
    );

    printUsage();

    process.exit(1);
  }

  const events =
    await loadFixture(
      resolve(fixturePath),
    );

  const engine =
    new ReconciliationEngine();

  const normalized =
    events.map(
      (event) =>
        normalizeEvent(event),
    );

  if (command === "ingest") {
    console.log(
      "\nCross-Chain Liquidity Reconciliation Engine\n",
    );

    for (
      const event of normalized
    ) {
      const result =
        engine.process(event);

      console.log(
        `[${result.decision}] ${event.event_id}`,
      );
    }

    printSummary(
      engine,
      normalized.length,
    );

    return;
  }

  /*
   * Replay starts from an empty engine and
   * reproduces the fixture's exact sequence.
   */

  for (
    const event of normalized
  ) {
    engine.process(event);
  }

  const eventIds =
    normalized.map(
      (event) =>
        event.event_id,
    );

  const result =
    engine.replay(
      eventIds,
    );

  console.log(
    "\nReplay completed successfully.\n",
  );

  console.log(
    `Events replayed: ${result.audit.length}`,
  );

  console.log(
    "Final state:",
  );

  console.log(
    JSON.stringify(
      result.state,
      (_, value) =>
        typeof value === "bigint"
          ? value.toString()
          : value,
      2,
    ),
  );
}

function printSummary(
  engine: ReconciliationEngine,
  totalEvents: number,
): void {
  const audit =
    engine.auditEntries();

  const counts =
    audit.reduce(
      (
        result,
        entry,
      ) => {
        result[entry.decision] =
          (result[entry.decision] ?? 0) +
          1;

        return result;
      },
      {} as Record<
        string,
        number
      >,
    );

  console.log(
    "\nSummary",
  );

  console.log(
    `Total events: ${totalEvents}`,
  );

  for (
    const [decision, count]
    of Object.entries(counts)
  ) {
    console.log(
      `${decision}: ${count}`,
    );
  }

  console.log(
    "\nCanonical state:",
  );

  console.log(
    JSON.stringify(
      engine.snapshot(),
      null,
      2,
    ),
  );
}

function printUsage(): void {
  console.log(`
Usage:

  npm run cli -- ingest <fixture>
  npm run cli -- replay <fixture>

Examples:

  npm run cli -- ingest fixtures/basic.json
  npm run cli -- replay fixtures/basic.json
`);
}

main().catch(
  (error) => {
    console.error(
      "CLI error:",
      error instanceof Error
        ? error.message
        : error,
    );

    process.exit(1);
  },
);