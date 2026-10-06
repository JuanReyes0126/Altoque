import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./prisma.js";

/** Filas y total de una página comparten snapshot, incluso durante escrituras concurrentes. */
export function readPageSnapshot<T>(read: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(read, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
