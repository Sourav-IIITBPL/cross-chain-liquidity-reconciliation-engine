import {
  ReconciliationEngine,
} from "./reconciler.js";

import {
  normalizeEvent,
} from "./validation.js";

const EVENT_COUNT = 10_000;

const TOKEN_A =
  "0x0000000000000000000000000000000000000001";

const TOKEN_B =
  "0x0000000000000000000000000000000000000002";

console.log(
  `Running reconciliation benchmark with ${EVENT_COUNT.toLocaleString()} events...`,
);

const engine =
  new ReconciliationEngine();

const start =
  process.hrtime.bigint();

for (
  let i = 0;
  i < EVENT_COUNT;
  i++
) {
  const event =
    normalizeEvent({
      chain: "Arbitrum",
      tokenA: TOKEN_A,
      tokenB: TOKEN_B,
      liquidity: String(
        1_000_000 + i,
      ),
      timestamp:
        1_700_000_000 + i,
      source: "router",
      event_id:
        `benchmark-${i}`,
      chain_id: 42161,
    });

  engine.process(event);
}

const end =
  process.hrtime.bigint();

const elapsedSeconds =
  Number(end - start) /
  1_000_000_000;

const eventsPerSecond =
  EVENT_COUNT /
  elapsedSeconds;

const memory =
  process.memoryUsage();

console.log();
console.log(
  `Events processed : ${EVENT_COUNT.toLocaleString()}`,
);

console.log(
  `Elapsed time     : ${elapsedSeconds.toFixed(4)}s`,
);

console.log(
  `Throughput       : ${eventsPerSecond.toFixed(2)} events/sec`,
);

console.log(
  `RSS              : ${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
);

console.log(
  `Heap used        : ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
);

console.log();

if (
  eventsPerSecond >= 100
) {
  console.log(
    "Performance target: PASS",
  );
} else {
  console.log(
    "Performance target: BELOW 100 events/sec",
  );
}

if (
  memory.rss <=
  256 * 1024 * 1024
) {
  console.log(
    "Memory target: PASS",
  );
} else {
  console.log(
    "Memory target: ABOVE 256 MB",
  );
}