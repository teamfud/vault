import { parentPort } from "node:worker_threads";
import { yescryptHash } from "./yescrypt";

// Runs yescrypt off the main thread; see yescryptPool.ts.
parentPort!.on("message", async ({ id, password, cost }: { id: number; password: string; cost: number }) => {
  try {
    parentPort!.postMessage({ id, hash: await yescryptHash(password, cost) });
  } catch (e) {
    parentPort!.postMessage({ id, error: (e as Error).message });
  }
});
