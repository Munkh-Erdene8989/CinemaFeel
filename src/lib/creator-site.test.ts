import assert from "node:assert/strict";
import test from "node:test";
import { creatorCatalog, creatorCornerTitle, creatorPath, creatorUsernameFromPath, creatorUsernameParam, nextCornerRename } from "./creator-site.ts";

test("creator links use a normalized username", () => {
  assert.equal(creatorUsernameParam("  Creator_Name "), "creator_name");
  assert.equal(creatorUsernameParam("ab"), "");
  assert.equal(creatorUsernameParam("bad name"), "");
  assert.equal(creatorUsernameFromPath("/c/Studio.01"), "studio.01");
  assert.equal(creatorUsernameFromPath("/c/Studio.01/extra"), "");
  assert.equal(creatorUsernameFromPath("/library"), "");
  assert.equal(creatorPath("studio.01"), "/c/studio.01");
});

test("a corner starts as the username and can be renamed twice", () => {
  assert.equal(creatorCornerTitle("suvdhan", ""), "suvdhan");
  assert.equal(creatorCornerTitle("suvdhan", "Сувдаа кино"), "Сувдаа кино");
  const first = nextCornerRename({ username: "suvdhan", cornerName: "", edits: 0 }, "Сувдаа кино");
  assert.deepEqual(first, { cornerName: "Сувдаа кино", edits: 1, changed: true });
  const same = nextCornerRename({ username: "suvdhan", cornerName: "Сувдаа кино", edits: 1 }, "Сувдаа кино");
  assert.deepEqual(same, { cornerName: "Сувдаа кино", edits: 1, changed: false });
  const second = nextCornerRename({ username: "suvdhan", cornerName: "Сувдаа кино", edits: 1 }, "suvdhan");
  assert.deepEqual(second, { cornerName: "", edits: 2, changed: true });
  const blocked = nextCornerRename({ username: "suvdhan", cornerName: "", edits: 2 }, "Шинэ булан");
  assert.deepEqual(blocked, { error: "Кино булангийн нэрийг 2 удаа сольсон байна." });
  assert.equal("error" in nextCornerRename({ username: "suvdhan", cornerName: "", edits: 0 }, "a"), true);
});

test("a creator page lists only that owner's series", () => {
  const series = [
    { id: "mine", ownerId: "creator" },
    { id: "other", ownerId: "someone" },
    { id: "blank", ownerId: "" },
  ];
  assert.deepEqual(creatorCatalog(series, "creator").map((item) => item.id), ["mine"]);
  assert.deepEqual(creatorCatalog(series, ""), []);
});
