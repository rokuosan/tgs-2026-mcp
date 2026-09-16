import assert from "node:assert/strict";
import test from "node:test";

import { decodeHtml, extractPage, extractSchedule } from "./update-official-content.mjs";

test("decodeHtml decodes named and numeric entities", () => {
  assert.equal(decodeHtml("A &amp; B &#x30B2;&#12540;ム"), "A & B ゲーム");
});

test("extractPage keeps visible main content and internal links", () => {
  const page = extractPage(
    '<title>案内</title><main><h1>開催情報</h1><p>幕張メッセ<br>開催</p><a href="/2026/news">詳細</a><script>hidden</script></main>',
    "https://tgs.cesa.or.jp/2026/about",
  );
  assert.equal(page.title, "案内");
  assert.match(page.content, /開催情報\n幕張メッセ\n開催/);
  assert.deepEqual(page.links, ["/2026/news"]);
});

test("extractSchedule parses titles, dates, and times", () => {
  const content = [
    "公式番組一覧",
    "公式番組一覧",
    "9/17",
    "(木)",
    "開会式",
    "イベントステージ実施",
    "2026.09.17 09:30 - 10:00",
    "タイムテーブル",
  ].join("\n");
  assert.deepEqual(extractSchedule(content, "official_program"), [
    {
      type: "official_program",
      title: "開会式",
      date: "2026-09-17",
      startTime: "09:30",
      endTime: "10:00",
    },
  ]);
});
