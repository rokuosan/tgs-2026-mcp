import { mkdir, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://tgs.cesa.or.jp/2026/exibition";
const DATA_MARKER = '"searchParams":{},"data":';

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

  const exhibitors = extractExhibitors(await response.text()).map((exhibitor) => ({
    id: exhibitor.booth_id,
    name: exhibitor.booth_name,
    nameEn: exhibitor.booth_name_en,
    nameKana: exhibitor.booth_name_kana,
    boothNumber: exhibitor.booth_number || null,
    hall: exhibitor.booth_area || null,
    area: exhibitor.corner_name,
    areaSlug: exhibitor.corner_slug,
    url: exhibitor.jp_url || exhibitor.global_url || exhibitor.url || null,
  }));

  await mkdir("src/data", { recursive: true });
  await writeFile(
    "src/data/exhibitors.json",
    `${JSON.stringify({ sourceUrl: SOURCE_URL, updatedAt: new Date().toISOString(), exhibitors }, null, 2)}\n`,
  );
  console.log(`Updated ${exhibitors.length} exhibitors`);
}
