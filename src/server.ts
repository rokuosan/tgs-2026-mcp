import { McpServer } from "@modelcontextprotocol/server";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

import data from "./data/exhibitors.json" with { type: "json" };

const searchInput = toStandardJsonSchema(
  v.object({
    query: v.optional(v.pipe(v.string(), v.maxLength(100))),
    hall: v.optional(v.pipe(v.string(), v.maxLength(30))),
    area: v.optional(v.pipe(v.string(), v.maxLength(100))),
    limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 20),
  }),
);

const idInput = toStandardJsonSchema(
  v.object({ id: v.pipe(v.string(), v.minLength(1), v.maxLength(20)) }),
);

const boothInput = toStandardJsonSchema(
  v.object({ boothNumber: v.pipe(v.string(), v.minLength(1), v.maxLength(30)) }),
);

const normalize = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase("ja");
const result = (value: object) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
});

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
      const exhibitors = data.exhibitors
        .filter(
          (exhibitor) =>
            (!normalizedQuery ||
              [exhibitor.name, exhibitor.nameEn, exhibitor.nameKana].some((name) =>
                normalize(name).includes(normalizedQuery),
              )) &&
            (!normalizedHall || (exhibitor.hall && normalize(exhibitor.hall) === normalizedHall)) &&
            (!normalizedArea || normalize(exhibitor.area).includes(normalizedArea)),
        )
        .slice(0, limit);

      return result({
        exhibitors,
        count: exhibitors.length,
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
      return result({ exhibitor, sourceUrl: data.sourceUrl, updatedAt: data.updatedAt });
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
        exhibitors,
        count: exhibitors.length,
        sourceUrl: data.sourceUrl,
        updatedAt: data.updatedAt,
      });
    },
  );

  return server;
}
