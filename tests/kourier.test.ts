import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { resetEnv, restoreEnv } from "./env";

const repo = "https://github.com/kuzzleio/kuzzle";
const notes = `## [2.60.0](${repo}/compare/v2.59.0...v2.60.0) (2026-10-27)

### Features

* **auth:** add API key deletion ([377c158](${repo}/commit/377c158)), closes [#3068](${repo}/issues/3068)
`;

/** A fake Kourier answering what the test sets in `reply`. */
let reply: { status: number; body: unknown };
let received: { authorization?: string; body: unknown; path?: string }[];
let server: Server;
let kourierUrl: string;

async function loadKourier(releaseChannel = "main") {
  vi.resetModules();
  vi.doMock("../lib/release-channel", () => ({ releaseChannel }));

  return import("../lib/kourier");
}

function context(env: Record<string, string | undefined> = {}) {
  return {
    env: {
      SEMANTIC_RELEASE_KOURIER_TOKEN: "emitter-key",
      SEMANTIC_RELEASE_KOURIER_URL: `${kourierUrl}/`,
      npm_package_name: "kuzzle",
      ...env,
    },
    logger: { error: vi.fn(), log: vi.fn() },
    nextRelease: { gitTag: "v2.60.0", notes, version: "2.60.0" },
    options: { repositoryUrl: "git+https://github.com/kuzzleio/kuzzle.git" },
  };
}

beforeAll(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      received.push({
        authorization: request.headers.authorization,
        body: JSON.parse(body),
        path: request.url,
      });
      response
        .writeHead(reply.status, { "Content-Type": "application/json" })
        .end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  kourierUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  restoreEnv();
});

beforeEach(() => {
  resetEnv();
  received = [];
  reply = {
    body: { result: { deliveries: 2, duplicate: false } },
    status: 200,
  };
});

describe("kourier success step", () => {
  it("posts the release event with the emitter key", async () => {
    const { success } = await loadKourier("develop");
    const ctx = context();

    await success({}, ctx);

    expect(received).toEqual([
      {
        authorization: "Bearer emitter-key",
        body: {
          channel: "develop",
          gitTag: "v2.60.0",
          notes,
          project: "kuzzle",
          releaseUrl: `${repo}/releases/tag/v2.60.0`,
          repositoryUrl: repo,
          sections: [
            {
              items: [
                {
                  commit: { hash: "377c158", url: `${repo}/commit/377c158` },
                  references: [{ label: "#3068", url: `${repo}/issues/3068` }],
                  scope: "auth",
                  subject: "add API key deletion",
                },
              ],
              title: "Features",
            },
          ],
          version: "2.60.0",
        },
        path: "/_/releases",
      },
    ]);
    expect(ctx.logger.log).toHaveBeenCalledWith(
      "Kourier notified of kuzzle 2.60.0: 2 notification(s) planned",
    );
  });

  it("does nothing without both variables", async () => {
    const { success } = await loadKourier();

    await success({}, context({ SEMANTIC_RELEASE_KOURIER_TOKEN: undefined }));

    expect(received).toEqual([]);
  });

  it("logs a refusal without failing the release", async () => {
    reply = { body: { error: { message: "Unauthorized" } }, status: 401 };
    const { success } = await loadKourier();
    const ctx = context();

    await expect(success({}, ctx)).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalledWith(
      "Kourier refused the release event (401): Unauthorized",
    );
  });

  it("logs an unreachable Kourier without failing the release", async () => {
    // A port nothing listens on any more.
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, resolve));
    const { port } = closed.address() as AddressInfo;
    await new Promise((resolve) => closed.close(resolve));

    const { success } = await loadKourier();
    const ctx = context({
      SEMANTIC_RELEASE_KOURIER_URL: `http://127.0.0.1:${port}`,
    });

    await expect(success({}, ctx)).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/^Kourier could not be reached: .*ECONNREFUSED/),
    );
  });
});
