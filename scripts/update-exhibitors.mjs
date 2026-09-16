import { mkdir, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://tgs.cesa.or.jp/2026/exibition";
const DATA_MARKER = '"searchParams":{},"data":';
const NOVELTY_PATTERN =
  /ノベルティ|無料配布|配布グッズ|来場特典|参加賞|プレゼント|giveaway|freebie/i;

export function getXAccount(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(parsed.hostname)) {
      return null;
    }

    const handle = parsed.pathname.split("/").filter(Boolean)[0];
    if (!handle || ["home", "i", "intent", "search", "share"].includes(handle)) return null;
    return { handle: `@${handle}`, url: `https://x.com/${handle}` };
  } catch {
    return null;
  }
}

export function getNoveltyMentions(exhibitor) {
  return [
    exhibitor.text,
    ...(exhibitor.events ?? []).flatMap((event) => [event.title, event.introduction]),
  ]
    .filter(Boolean)
    .flatMap((text) => text.split(/(?<=[。！？\n])/u))
    .map((text) => text.trim())
    .filter((text) => text && NOVELTY_PATTERN.test(text));
}

export function extractJsonArray(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index++) {
    const character = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === "[") depth++;
    else if (character === "]" && --depth === 0) return text.slice(start, index + 1);
  }

  throw new Error("Could not find the end of the exhibitor data");
}

export function extractExhibitors(html) {
  const chunks = [
    ...html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)<\/script>/gs),
  ].map(([, encoded]) => JSON.parse(encoded));
  const chunk = chunks.find((value) => value.includes(DATA_MARKER));
  if (!chunk) throw new Error("Could not find exhibitor data in the official page");

  const start = chunk.indexOf("[", chunk.indexOf(DATA_MARKER) + DATA_MARKER.length);
  return JSON.parse(extractJsonArray(chunk, start));
}

if (import.meta.main) {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status}`);

  const exhibitors = extractExhibitors(await response.text()).map((exhibitor) => {
    const urls = [
      exhibitor.url,
      exhibitor.jp_url,
      exhibitor.global_url,
      ...(exhibitor.works ?? []).map((work) => work.url),
      ...(exhibitor.events ?? []).map((event) => event.url),
    ];
    const xAccounts = [
      ...new Map(
        urls
          .map(getXAccount)
          .filter(Boolean)
          .map((account) => [account.handle, account]),
      ).values(),
    ];

    return {
      id: exhibitor.booth_id,
      name: exhibitor.booth_name,
      nameEn: exhibitor.booth_name_en,
      nameKana: exhibitor.booth_name_kana,
      boothNumber: exhibitor.booth_number || null,
      hall: exhibitor.booth_area || null,
      area: exhibitor.corner_name,
      areaSlug: exhibitor.corner_slug,
      description: exhibitor.text || null,
      url: exhibitor.jp_url || exhibitor.global_url || exhibitor.url || null,
      xAccounts,
      titles: (exhibitor.works ?? [])
        .filter((work) => work.title)
        .map((work) => ({
          title: work.title,
          genre: work.genre || null,
          releaseDate: work.release_date || null,
          platform: work.platform || null,
          place: work.place || null,
          url: work.url || null,
          rating: work.cero || null,
          vr: work.vr || null,
        })),
      events: (exhibitor.events ?? [])
        .filter((event) => event.title)
        .map((event) => ({
          title: event.title,
          genre: event.genre || null,
          description: event.introduction || null,
          date: event.date || null,
          url: event.url || null,
        })),
      merchandise: (exhibitor.items ?? []).map((item) => ({
        name: item.item_name,
        price: item.item_price || null,
        description: item.item_text || null,
      })),
      novelties: getNoveltyMentions(exhibitor),
    };
  });

  await mkdir("src/data", { recursive: true });
  await writeFile(
    "src/data/exhibitors.json",
    `${JSON.stringify({ sourceUrl: SOURCE_URL, updatedAt: new Date().toISOString(), exhibitors }, null, 2)}\n`,
  );
  console.log(`Updated ${exhibitors.length} exhibitors`);
}
