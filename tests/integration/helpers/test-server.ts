import type { AddressInfo } from "node:net";
import {
  createCrdtRoomStore,
  createInMemoryCrdtPersistence,
  createMemoryPersistence,
  createSyncHttpServer,
  type SyncHttpServer,
} from "@slisync/sync-server";
import type { AuthEnv } from "./env";
import { withAuthEnv } from "./env";

export type TestSyncServer = {
  baseUrl: string;
  sync: SyncHttpServer;
  close: () => Promise<void>;
};

export async function startTestSyncServer(
  auth?: AuthEnv,
): Promise<TestSyncServer> {
  return withAuthEnv(auth, async () => {
    const persistence = createMemoryPersistence();
    const crdtRoomStore = createCrdtRoomStore(
      { message: "Hello from shared memory", counter: 0, agentLog: [] },
      createInMemoryCrdtPersistence(),
    );
    const sync = createSyncHttpServer({
      port: 0,
      host: "127.0.0.1",
      persistence,
      crdtRoomStore,
    });

    await sync.listen();

    const addr = sync.httpServer.address() as AddressInfo | null;
    if (!addr?.port) {
      await sync.close();
      throw new Error("failed to bind test sync server");
    }

    const baseUrl = `http://127.0.0.1:${addr.port}`;

    return {
      baseUrl,
      sync,
      close: async () => {
        await sync.close();
      },
    };
  });
}
