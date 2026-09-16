import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

import data from "./data/exhibitors.json" with { type: "json" };
import foodData from "./data/food.json" with { type: "json" };
import officialData from "./data/official-content.json" with { type: "json" };
import xData from "./data/x-posts.json" with { type: "json" };

const searchInput = z.object({
  query: z.string().max(100).optional(),
  hall: z.string().max(30).optional(),
  area: z.string().max(100).optional(),
  limit: z.int().min(1).max(100).default(20),
});

const idInput = z.object({ id: z.string().min(1).max(20) });

const boothInput = z.object({ boothNumber: z.string().min(1).max(30) });

const titleInput = z.object({
  query: z.string().max(100).optional(),
  genre: z.string().max(100).optional(),
  platform: z.string().max(100).optional(),
  exhibitor: z.string().max(100).optional(),
  limit: z.int().min(1).max(100).default(20),
});

const eventInput = z.object({
  query: z.string().max(100).optional(),
  date: z.string().max(30).optional(),
  exhibitor: z.string().max(100).optional(),
  limit: z.int().min(1).max(100).default(20),
});

const merchandiseInput = z.object({
  query: z.string().max(100).optional(),
  exhibitor: z.string().max(100).optional(),
  limit: z.int().min(1).max(100).default(20),
});

const noveltyInput = merchandiseInput;

const foodInput = z.object({
  query: z.string().max(100).optional(),
  vendor: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  maxPriceYen: z.int().min(0).optional(),
  limit: z.int().min(1).max(100).default(20),
});

const officialInfoInput = z.object({
  query: z.string().max(200).optional(),
  path: z.string().max(100).optional(),
  limit: z.int().min(1).max(50).default(10),
});

const officialPageInput = z.object({ path: z.string().min(1).max(200) });

const scheduleInput = z.object({
  query: z.string().max(100).optional(),
  date: z.string().max(30).optional(),
  type: z.enum(["event_stage", "official_program"]).optional(),
  limit: z.int().min(1).max(100).default(20),
});

const normalize = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase("ja");
const contains = (value: string | null, query: string | undefined) =>
  !query || normalize(value ?? "").includes(normalize(query));
const xPostsByExhibitor = Map.groupBy(xData.posts, (post) => post.exhibitorIds[0]);
const getXAccounts = (exhibitor: (typeof data.exhibitors)[number]) => [
  ...new Map(
    [
      ...exhibitor.xAccounts.map((account) => ({ ...account, sourceUrl: data.sourceUrl })),
      ...(xPostsByExhibitor.get(exhibitor.id) ?? []).map((post) => ({
        ...post.author,
        sourceUrl: post.url,
      })),
    ].map((account) => [account.handle.toLocaleLowerCase("en"), account]),
  ).values(),
];
const summarize = (exhibitor: (typeof data.exhibitors)[number]) => ({
  id: exhibitor.id,
  name: exhibitor.name,
  nameEn: exhibitor.nameEn,
  boothNumber: exhibitor.boothNumber,
  hall: exhibitor.hall,
  area: exhibitor.area,
  url: exhibitor.url,
  xAccounts: getXAccounts(exhibitor),
});
const detail = (exhibitor: (typeof data.exhibitors)[number]) => ({
  ...exhibitor,
  xAccounts: getXAccounts(exhibitor),
  xPosts: xPostsByExhibitor.get(exhibitor.id) ?? [],
});
const result = (value: object) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
});
const excerpt = (content: string, query: string | undefined) => {
  const lines = content.split("\n");
  if (!query) return lines.slice(0, 8).join("\n");
  const matches = lines.filter((line) => contains(line, query));
  return (matches.length ? matches : lines).slice(0, 5).join("\n");
};

export function createServer() {
  const server = new McpServer({ name: "tgs-2026-mcp", version: "0.1.0" });

  server.registerTool(
    "search_exhibitors",
    {
      title: "Search TGS 2026 exhibitors",
      description: "Search exhibitors by company name, hall, or exhibition area.",
      inputSchema: searchInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, hall, area, limit }) => {
      const normalizedQuery = query && normalize(query);
      const normalizedHall = hall && normalize(hall);
      const normalizedArea = area && normalize(area);
      const matches = data.exhibitors.filter(
        (exhibitor) =>
          (!normalizedQuery ||
            [exhibitor.name, exhibitor.nameEn, exhibitor.nameKana].some((name) =>
              normalize(name).includes(normalizedQuery),
            )) &&
          (!normalizedHall || (exhibitor.hall && normalize(exhibitor.hall) === normalizedHall)) &&
          (!normalizedArea || normalize(exhibitor.area).includes(normalizedArea)),
      );
      const exhibitors = matches.slice(0, limit).map(summarize);

      return result({
        exhibitors,
        count: exhibitors.length,
        total: matches.length,
        sourceUrl: data.sourceUrl,
        updatedAt: data.updatedAt,
      });
    },
  );

  server.registerTool(
    "get_exhibitor",
    {
      title: "Get a TGS 2026 exhibitor",
      description: "Get one exhibitor by its official exhibitor ID.",
      inputSchema: idInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ id }) => {
      const exhibitor = data.exhibitors.find((item) => item.id === id.trim());
      if (!exhibitor) {
        return {
          content: [{ type: "text" as const, text: `Exhibitor ${id} was not found.` }],
          isError: true,
        };
      }
      return result({
        exhibitor: detail(exhibitor),
        sourceUrl: data.sourceUrl,
        updatedAt: data.updatedAt,
      });
    },
  );

  server.registerTool(
    "find_booth",
    {
      title: "Find a TGS 2026 booth",
      description: "Find every exhibitor assigned to an exact booth number.",
      inputSchema: boothInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ boothNumber }) => {
      const normalizedBoothNumber = normalize(boothNumber);
      const exhibitors = data.exhibitors.filter(
        (exhibitor) =>
          exhibitor.boothNumber && normalize(exhibitor.boothNumber) === normalizedBoothNumber,
      );
      return result({
        exhibitors: exhibitors.map(summarize),
        count: exhibitors.length,
        sourceUrl: data.sourceUrl,
        updatedAt: data.updatedAt,
      });
    },
  );

  server.registerTool(
    "search_titles",
    {
      title: "Search TGS 2026 titles",
      description: "Search exhibited games by title, genre, platform, or exhibitor.",
      inputSchema: titleInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, genre, platform, exhibitor, limit }) => {
      const matches = data.exhibitors
        .flatMap((owner) =>
          owner.titles.map((title) => ({ ...title, exhibitor: summarize(owner) })),
        )
        .filter(
          (item) =>
            contains(item.title, query) &&
            contains(item.genre, genre) &&
            contains(item.platform, platform) &&
            contains(`${item.exhibitor.name} ${item.exhibitor.nameEn}`, exhibitor),
        );
      return result({
        titles: matches.slice(0, limit),
        count: Math.min(matches.length, limit),
        total: matches.length,
        sourceUrl: data.sourceUrl,
        updatedAt: data.updatedAt,
      });
    },
  );

  server.registerTool(
    "search_events",
    {
      title: "Search TGS 2026 events",
      description: "Search booth events by name, description, date, or exhibitor.",
      inputSchema: eventInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, date, exhibitor, limit }) => {
      const matches = data.exhibitors
        .flatMap((owner) =>
          owner.events.map((event) => ({ ...event, exhibitor: summarize(owner) })),
        )
        .filter(
          (item) =>
            contains(`${item.title} ${item.description ?? ""}`, query) &&
            contains(item.date, date) &&
            contains(`${item.exhibitor.name} ${item.exhibitor.nameEn}`, exhibitor),
        );
      return result({
        events: matches.slice(0, limit),
        count: Math.min(matches.length, limit),
        total: matches.length,
        sourceUrl: data.sourceUrl,
        updatedAt: data.updatedAt,
      });
    },
  );

  server.registerTool(
    "search_merchandise",
    {
      title: "Search TGS 2026 merchandise",
      description: "Search merchandise listed by exhibitors.",
      inputSchema: merchandiseInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, exhibitor, limit }) => {
      const matches = data.exhibitors
        .flatMap((owner) =>
          owner.merchandise.map((item) => ({ ...item, exhibitor: summarize(owner) })),
        )
        .filter(
          (item) =>
            contains(`${item.name} ${item.description ?? ""}`, query) &&
            contains(`${item.exhibitor.name} ${item.exhibitor.nameEn}`, exhibitor),
        );
      return result({
        merchandise: matches.slice(0, limit),
        count: Math.min(matches.length, limit),
        total: matches.length,
        sourceUrl: data.sourceUrl,
        updatedAt: data.updatedAt,
      });
    },
  );

  server.registerTool(
    "search_novelties",
    {
      title: "Search TGS 2026 novelties",
      description: "Search official exhibitor descriptions for giveaways and visitor benefits.",
      inputSchema: noveltyInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, exhibitor, limit }) => {
      const officialSiteNovelties = data.exhibitors.flatMap((owner) =>
        owner.novelties.map((description) => ({
          description,
          conditions: null,
          source: "official_site",
          sourceUrl: data.sourceUrl,
          publishedAt: data.updatedAt,
          exhibitor: summarize(owner),
        })),
      );
      const xNovelties = xData.posts.flatMap((post) =>
        post.exhibitorIds.flatMap((exhibitorId) => {
          const owner = data.exhibitors.find((exhibitor) => exhibitor.id === exhibitorId);
          return owner
            ? [
                {
                  ...post.novelty,
                  source: "x",
                  sourceUrl: post.url,
                  publishedAt: post.publishedAt,
                  xAccount: post.author,
                  exhibitor: summarize(owner),
                },
              ]
            : [];
        }),
      );
      const matches = [...officialSiteNovelties, ...xNovelties].filter(
        (item) =>
          contains(`${item.description} ${item.conditions ?? ""}`, query) &&
          contains(`${item.exhibitor.name} ${item.exhibitor.nameEn}`, exhibitor),
      );
      return result({
        novelties: matches.slice(0, limit),
        count: Math.min(matches.length, limit),
        total: matches.length,
        sourceUrl: data.sourceUrl,
        updatedAt: data.updatedAt,
        xSearchedAt: xData.searchedAt,
      });
    },
  );

  server.registerTool(
    "search_food",
    {
      title: "Search TGS 2026 food",
      description: "Search official food court menus by item, vendor, location, or price.",
      inputSchema: foodInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, vendor, location, maxPriceYen, limit }) => {
      const matches = foodData.items.filter(
        (item) =>
          contains(`${item.name} ${item.description}`, query) &&
          contains(item.vendor, vendor) &&
          contains(item.location, location) &&
          (maxPriceYen === undefined || item.priceMinYen <= maxPriceYen),
      );
      const foods = matches.slice(0, limit).map((item) => ({
        ...item,
        hours: foodData.locations.find((location) => location.name === item.location)?.hours ?? [],
      }));
      return result({
        foods,
        count: foods.length,
        total: matches.length,
        sourceUrl: foodData.sourceUrl,
        updatedAt: foodData.updatedAt,
      });
    },
  );

  server.registerTool(
    "search_schedule",
    {
      title: "Search TGS 2026 official schedule",
      description: "Search official event stage and streaming program schedules.",
      inputSchema: scheduleInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, date, type, limit }) => {
      const matches = officialData.schedules.filter(
        (item) =>
          contains(item.title, query) && contains(item.date, date) && (!type || item.type === type),
      );
      const schedules = matches.slice(0, limit).map((item) => ({
        ...item,
        sourceUrl: `${officialData.sourceUrl}${item.type === "event_stage" ? "event" : "program"}`,
      }));
      return result({
        schedules,
        count: schedules.length,
        total: matches.length,
        updatedAt: officialData.updatedAt,
      });
    },
  );

  server.registerTool(
    "search_official_info",
    {
      title: "Search TGS 2026 official information",
      description:
        "Search official visitor information, tickets, news, access, rules, special projects, and other TGS pages.",
      inputSchema: officialInfoInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, path, limit }) => {
      const matches = officialData.pages.filter(
        (page) => contains(`${page.title} ${page.content}`, query) && contains(page.path, path),
      );
      const pages = matches.slice(0, limit).map((page) => ({
        title: page.title,
        path: page.path,
        url: page.url,
        excerpt: excerpt(page.content, query),
      }));
      return result({
        pages,
        count: pages.length,
        total: matches.length,
        sourceUrl: officialData.sourceUrl,
        updatedAt: officialData.updatedAt,
      });
    },
  );

  server.registerTool(
    "get_official_page",
    {
      title: "Get a TGS 2026 official information page",
      description: "Get the full indexed content of an official TGS page by path or URL.",
      inputSchema: officialPageInput,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ path }) => {
      let requestedPath = path.trim();
      try {
        requestedPath = new URL(requestedPath).pathname;
      } catch {
        if (!requestedPath.startsWith("/")) requestedPath = `/${requestedPath}`;
        if (!requestedPath.startsWith("/2026")) requestedPath = `/2026${requestedPath}`;
      }
      const page = officialData.pages.find(
        (item) => item.path.replace(/\/$/, "") === requestedPath.replace(/\/$/, ""),
      );
      if (!page) {
        return {
          content: [{ type: "text" as const, text: `Official page ${path} was not found.` }],
          isError: true,
        };
      }
      return result({
        page,
        updatedAt: officialData.updatedAt,
      });
    },
  );

  return server;
}
