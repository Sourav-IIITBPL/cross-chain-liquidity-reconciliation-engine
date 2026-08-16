import {
  appendFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";

import { dirname } from "node:path";

import type {
  AuditEntry,
} from "./types.js";

export class AuditTrail {
  private entries: AuditEntry[] = [];

  private readonly outputPath?: string;

  constructor(
    outputPath?: string,
  ) {
    this.outputPath =
      outputPath;

    if (outputPath) {
      mkdirSync(
        dirname(outputPath),
        {
          recursive: true,
        },
      );
    }
  }

  add(
    entry: AuditEntry,
  ): void {
    this.entries.push(
      structuredClone(entry),
    );

    if (this.outputPath) {
      appendFileSync(
        this.outputPath,
        `${JSON.stringify(entry)}\n`,
        "utf8",
      );
    }
  }

  all(): AuditEntry[] {
    return structuredClone(
      this.entries,
    );
  }

  clear(): void {
    this.entries = [];

    if (this.outputPath) {
      writeFileSync(
        this.outputPath,
        "",
        "utf8",
      );
    }
  }
}