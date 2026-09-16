import { mkdir, writeFile } from "node:fs/promises";

const BASE_URL = "https://tgs.cesa.or.jp";
const OUTPUT_PATH = "src/data/official-content.json";
const START_PATHS = [
  "/2026/",
  "/2026/30th",
  "/2026/about",
  "/2026/access",
  "/2026/archives",
  "/2026/business",
  "/2026/caution",
  "/2026/contact",
  "/2026/cosplay_area",
  "/2026/event",
  "/2026/faq",
  "/2026/fgp",
  "/2026/food/",
  "/2026/goods",
  "/2026/indie",
  "/2026/influencer",
  "/2026/map",
  "/2026/news",
  "/2026/oversea",
  "/2026/press",
  "/2026/program",
  "/2026/sns",
  "/2026/ticket?public=true",
];

const BLOCK_END = /<\/(?:h[1-6]|p|li|div|section|article|tr|dt|dd)>/gi;
const TAG = /<[^>]+>/g;

export function decodeHtml(value) {
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const hexadecimal = entity[1].toLowerCase() === "x";
      return String.fromCodePoint(
        Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10),
      );
    }
    return entities[entity] ?? match;
  });
}

export function extractPage(html, url) {
  const title = decodeHtml(html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] ?? url).trim();
  const main = html.match(/<main(?:\s[^>]*)?>(.*?)<\/main>/is)?.[1];
  if (!main) throw new Error(`Could not find main content in ${url}`);

  const content = decodeHtml(
    main
      .replace(/<(?:script|style)[^>]*>[\s\S]*?<\/(?:script|style)>/gi, "")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(BLOCK_END, "\n")
      .replace(TAG, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && line !== "PAGE TOP")
    .join("\n");

  const links = [
    ...new Set(
      [...main.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
        .map(([, href]) => new URL(decodeHtml(href), url))
        .filter((link) => link.origin === BASE_URL)
        .map((link) => `${link.pathname}${link.search}`),
    ),
  ];
  return { title, url, path: new URL(url).pathname, content, links };
}

export function extractSchedule(content, type) {
  const lines = content.split("\n");
  const heading = type === "event_stage" ? "イベントステージ一覧" : "公式番組一覧";
  const start = lines.indexOf(heading, lines.indexOf(heading) + 1);
  const end = lines.indexOf("タイムテーブル", start + 1);
  const section = lines.slice(start + 1, end);
  const entries = [];

  for (let index = 0; index < section.length; index++) {
    const dateAndTime = section[index].match(
      /^(2026\.\d{2}\.\d{2}) (\d{2}:\d{2}) - (\d{2}:\d{2})$/,
    );
    if (!dateAndTime) continue;

    let titleIndex = index - 1;
    while (
      titleIndex >= 0 &&
      (section[titleIndex] === "イベントステージ実施" ||
        /^\(.+\)$/.test(section[titleIndex]) ||
        /^\d{1,2}\/\d{1,2}$/.test(section[titleIndex]))
    ) {
      titleIndex--;
    }
    entries.push({
      type,
      title: section[titleIndex],
      date: dateAndTime[1].replaceAll(".", "-"),
      startTime: dateAndTime[2],
      endTime: dateAndTime[3],
    });
  }
  return entries;
}

const shouldCrawl = (path) => /^\/2026\/news\/detail\/[\w-]+\/?$/.test(path);

if (import.meta.main) {
  const pending = [...START_PATHS];
  const seen = new Set();
  const pages = [];

  while (pending.length) {
    const path = pending.shift();
    const url = new URL(path, BASE_URL).href;
    if (seen.has(url)) continue;
    seen.add(url);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    const page = extractPage(await response.text(), url);
    pages.push(page);
    for (const link of page.links) {
      if (shouldCrawl(new URL(link, BASE_URL).pathname)) pending.push(link);
    }
  }

  const eventPage = pages.find((page) => page.path === "/2026/event");
  const programPage = pages.find((page) => page.path === "/2026/program");
  const schedules = [
    ...extractSchedule(eventPage.content, "event_stage"),
    ...extractSchedule(programPage.content, "official_program"),
  ];

  await mkdir("src/data", { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify({ sourceUrl: `${BASE_URL}/2026/`, updatedAt: new Date().toISOString(), pages, schedules }, null, 2)}\n`,
  );
  console.log(`Updated ${pages.length} official pages and ${schedules.length} schedules`);
}
