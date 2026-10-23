import "server-only";
import { Worker } from "node:worker_threads";

/*
 * yescrypt is CPU- and memory-heavy (cost 7 ≈ 0.6s and 64 MiB), so hashes run
 * in worker threads instead of on the event loop. Jobs beyond the pool size
 * wait in a short queue; past that, callers get a "busy" error rather than
 * piling up memory. Idle workers exit so their heaps (up to 64 MiB+ each)
 * go back to the OS between bursts.
 */

const POOL_SIZE = 2;
const MAX_QUEUE = 8;
const TIMEOUT_MS = 15_000;
const IDLE_MS = 30_000;

type Job = { password: string; cost: number; resolve: (hash: string) => void; reject: (e: Error) => void };
type Slot = { worker: Worker; busy: boolean; idle?: ReturnType<typeof setTimeout> };

let nextId = 0;
const slots: Slot[] = [];
const queue: Job[] = [];

export class HashBusyError extends Error {}

function spawn(): Slot {
  const worker = new Worker(new URL("./yescrypt.worker.ts", import.meta.url));
  worker.unref();
  const slot = { worker, busy: false };
  worker.on("error", () => replace(slot));
  worker.on("exit", () => replace(slot));
  return slot;
}

function replace(slot: Slot) {
  const i = slots.indexOf(slot);
  if (i >= 0) slots.splice(i, 1);
}

function run(slot: Slot, job: Job) {
  clearTimeout(slot.idle);
  slot.busy = true;
  const id = nextId++;
  const done = () => {
    clearTimeout(timer);
    slot.worker.off("message", onMessage);
    slot.worker.off("exit", onExit);
    slot.busy = false;
    pump();
    if (!slot.busy) {
      slot.idle = setTimeout(() => {
        replace(slot);
        slot.worker.terminate();
      }, IDLE_MS);
      slot.idle.unref();
    }
  };
  const onMessage = (msg: { id: number; hash?: string; error?: string }) => {
    if (msg.id !== id) return;
    done();
    if (msg.hash) job.resolve(msg.hash);
    else job.reject(new Error(msg.error ?? "hashing failed"));
  };
  const onExit = () => {
    done();
    job.reject(new Error("hash worker died"));
  };
  const timer = setTimeout(() => {
    // A stuck worker can't be interrupted, so replace it.
    slot.worker.terminate();
    onExit();
  }, TIMEOUT_MS);
  slot.worker.on("message", onMessage);
  slot.worker.on("exit", onExit);
  slot.worker.postMessage({ id, password: job.password, cost: job.cost });
}

function pump() {
  while (queue.length) {
    let slot = slots.find((s) => !s.busy);
    if (!slot && slots.length < POOL_SIZE) {
      slot = spawn();
      slots.push(slot);
    }
    if (!slot) return;
    run(slot, queue.shift()!);
  }
}

/** yescryptHash() on a worker thread. Rejects with HashBusyError when the queue is full. */
export function yescryptHashAsync(password: string, cost: number): Promise<string> {
  if (queue.length >= MAX_QUEUE) return Promise.reject(new HashBusyError("hash queue full"));
  return new Promise((resolve, reject) => {
    queue.push({ password, cost, resolve, reject });
    pump();
  });
}
