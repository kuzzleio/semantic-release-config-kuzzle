import { describe, expect, it } from "vitest";

import { getRepositoryWebUrl, parseReleaseNotes } from "../lib/release-notes";
import { markdownToMrkdwn, onSlackSuccess } from "../lib/slack";

const repo = "https://github.com/kuzzleio/kuzzle";

const notes = `## [2.60.0-beta.5](${repo}/compare/v2.60.0-beta.4...v2.60.0-beta.5) (2026-10-27)

### ⚠ BREAKING CHANGES

* **http:** the routes to four removed API actions are gone,
use the new controller instead

### Features

* **auth:** add DELETE /api-keys to delete one's own API key ([377c158](${repo}/commit/377c158dc4b612e326bec10ab23009b565698d10)), closes [#3068](${repo}/issues/3068) [#3069](${repo}/issues/3069)

### Bug Fixes

* **logger:** make Logger.child() return a Logger ([d77330a](${repo}/commit/d77330a52dcedf641f96cabadcd75aaef034a696))
* handle <script> & friends in [#12](${repo}/issues/12) ([3308c16](${repo}/commit/3308c161153b42c214c0a5dc7bfee94fbe3cdcc0))
`;

function buildContext(overrides: { notes?: string; channel?: string } = {}) {
  return {
    env: { npm_package_name: "kuzzle" },
    nextRelease: {
      channel: overrides.channel,
      gitTag: "v2.60.0-beta.5",
      notes: overrides.notes ?? notes,
      version: "2.60.0-beta.5",
    },
    options: { repositoryUrl: "git+https://github.com/kuzzleio/kuzzle.git" },
  };
}

describe("parseReleaseNotes", () => {
  it("extracts the version header, sections and items", () => {
    const parsed = parseReleaseNotes(notes);

    expect(parsed.version).toBe("2.60.0-beta.5");
    expect(parsed.date).toBe("2026-10-27");
    expect(parsed.compareUrl).toBe(
      `${repo}/compare/v2.60.0-beta.4...v2.60.0-beta.5`,
    );
    expect(parsed.sections.map(({ title }) => title)).toEqual([
      "⚠ BREAKING CHANGES",
      "Features",
      "Bug Fixes",
    ]);
    expect(parsed.sections[0].items).toEqual([
      {
        references: [],
        scope: "http",
        subject:
          "the routes to four removed API actions are gone, use the new controller instead",
      },
    ]);
    expect(parsed.sections[1].items).toEqual([
      {
        commit: {
          hash: "377c158",
          url: `${repo}/commit/377c158dc4b612e326bec10ab23009b565698d10`,
        },
        references: [
          { label: "#3068", url: `${repo}/issues/3068` },
          { label: "#3069", url: `${repo}/issues/3069` },
        ],
        scope: "auth",
        subject: "add DELETE /api-keys to delete one's own API key",
      },
    ]);
    expect(parsed.sections[2].items[1]).toMatchObject({
      references: [],
      scope: undefined,
      subject: `handle <script> & friends in [#12](${repo}/issues/12)`,
    });
  });

  it("parses a header without compare link and drops empty sections", () => {
    const parsed = parseReleaseNotes("## 1.0.0 (2026-01-01)\n\n### Features\n");

    expect(parsed).toEqual({
      compareUrl: undefined,
      date: "2026-01-01",
      sections: [],
      version: "1.0.0",
    });
  });
});

describe("getRepositoryWebUrl", () => {
  it.each([
    ["git+https://github.com/kuzzleio/kuzzle.git", repo],
    ["git@github.com:kuzzleio/kuzzle.git", repo],
    ["ssh://git@github.com/kuzzleio/kuzzle.git", repo],
    [repo, repo],
  ])("normalizes %s", (input, expected) => {
    expect(getRepositoryWebUrl(input)).toBe(expected);
  });
});

describe("markdownToMrkdwn", () => {
  it("converts links and bold, and escapes the rest", () => {
    expect(markdownToMrkdwn("**a** <b> & [#1](https://x.test/1)")).toBe(
      "*a* &lt;b&gt; &amp; <https://x.test/1|#1>",
    );
  });
});

describe("onSlackSuccess", () => {
  it("renders the release as Block Kit", () => {
    const message = onSlackSuccess({}, buildContext({ channel: "develop" }));

    expect(message.text).toBe("kuzzle 2.60.0-beta.5 has been released");
    expect(message.blocks).toEqual([
      {
        text: {
          emoji: true,
          text: ":rocket: kuzzle 2.60.0-beta.5",
          type: "plain_text",
        },
        type: "header",
      },
      {
        elements: [
          {
            text: `:calendar: 2026-10-27   •   :satellite_antenna: Channel \`develop\`   •   :mag: <${repo}/compare/v2.60.0-beta.4...v2.60.0-beta.5|Compare changes>`,
            type: "mrkdwn",
          },
        ],
        type: "context",
      },
      {
        text: {
          text: "*⚠ BREAKING CHANGES*\n• *http:* the routes to four removed API actions are gone, use the new controller instead",
          type: "mrkdwn",
        },
        type: "section",
      },
      {
        text: {
          text: `*:sparkles: Features*\n• *auth:* add DELETE /api-keys to delete one's own API key (<${repo}/commit/377c158dc4b612e326bec10ab23009b565698d10|377c158>, <${repo}/issues/3068|#3068>, <${repo}/issues/3069|#3069>)`,
          type: "mrkdwn",
        },
        type: "section",
      },
      {
        text: {
          text: `*:bug: Bug Fixes*\n• *logger:* make Logger.child() return a Logger (<${repo}/commit/d77330a52dcedf641f96cabadcd75aaef034a696|d77330a>)\n• handle &lt;script&gt; &amp; friends in <${repo}/issues/12|#12> (<${repo}/commit/3308c161153b42c214c0a5dc7bfee94fbe3cdcc0|3308c16>)`,
          type: "mrkdwn",
        },
        type: "section",
      },
      {
        elements: [
          {
            text: { text: "View release", type: "plain_text" },
            type: "button",
            url: `${repo}/releases/tag/v2.60.0-beta.5`,
          },
        ],
        type: "actions",
      },
    ]);
  });

  it("prefers SEMANTIC_RELEASE_PACKAGE and says when nothing changed", () => {
    const context = buildContext({ notes: "## 1.0.0 (2026-01-01)\n" });
    context.env = { SEMANTIC_RELEASE_PACKAGE: "my-app" } as typeof context.env;

    const message = onSlackSuccess({}, context);

    expect(message.blocks?.[0]).toMatchObject({
      text: { text: ":rocket: my-app 2.60.0-beta.5" },
    });
    expect(message.blocks?.[2]).toEqual({
      text: { text: "_No notable changes._", type: "mrkdwn" },
      type: "section",
    });
  });

  it("splits large sections and stays within Slack's limits", () => {
    const items = Array.from(
      { length: 600 },
      (_, index) =>
        `* **scope:** change number ${index} with a reasonably long subject ([abcdef${index % 10}](${repo}/commit/abcdef${index % 10}))`,
    ).join("\n");

    const message = onSlackSuccess(
      {},
      buildContext({
        notes: `## 1.0.0 (2026-01-01)\n\n### Bug Fixes\n\n${items}\n`,
      }),
    );
    const blocks = message.blocks ?? [];
    const sections = blocks.filter(({ type }) => type === "section") as {
      text: { text: string };
    }[];

    expect(blocks.length).toBeLessThanOrEqual(50);
    expect(blocks.at(-1)).toMatchObject({ type: "actions" });
    expect(
      sections.reduce((length, { text }) => length + text.text.length, 0),
    ).toBeLessThanOrEqual(12000 + 200);
    for (const { text } of sections) {
      expect(text.text.length).toBeLessThanOrEqual(2900);
    }
    expect(sections.at(-1)?.text.text).toMatch(
      /^_…and \d+ more changes, see the <https:\/\/github\.com\/kuzzleio\/kuzzle\/releases\/tag\/v2\.60\.0-beta\.5\|full release notes>\._$/,
    );
  });
});
