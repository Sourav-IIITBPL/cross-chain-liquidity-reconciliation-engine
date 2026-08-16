import {
  readFile,
} from "node:fs/promises";

import type {
  RawLiquidityEvent,
} from "./types.js";

export async function loadFixture(
  path: string,
): Promise<RawLiquidityEvent[]> {
  const content =
    await readFile(
      path,
      "utf8",
    );

  const parsed: unknown =
    JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Fixture must contain a JSON array",
    );
  }

  return parsed as RawLiquidityEvent[];
}