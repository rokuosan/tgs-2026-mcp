# TOKYO GAME SHOW 2026 Unofficial MCP server

An unofficial MCP server for finding exhibitors and booth locations at TOKYO GAME SHOW 2026.

## Tools

- `search_exhibitors`: Search by exhibitor name, hall, or exhibition area.
- `get_exhibitor`: Get an exhibitor by its official ID.
- `find_booth`: Find exhibitors at an exact booth number.
- `search_titles`: Search games by title, genre, platform, or exhibitor.
- `search_events`: Search booth events by name, date, or exhibitor.
- `search_merchandise`: Search merchandise listed by exhibitors.
- `search_novelties`: Search official descriptions for giveaways and visitor benefits.

Exhibitor results include X accounts when the official exhibitor data contains a matching X URL.

## Roadmap

- [ ] Find additional official accounts from `#TGS2026` posts and exhibitor or title names, then attach source post URLs and concrete novelty details.

## Requirements

- mise
- Node.js
- pnpm 12

## Development

```sh
pnpm install
pnpm dev
```

The MCP endpoint is available at `/mcp`.

Run `pnpm data:update` to refresh `src/data/exhibitors.json` from the
[official exhibitor list](https://tgs.cesa.or.jp/2026/exibition).

```sh
pnpm check
pnpm test
pnpm format:check
```

## Deployment

- Cloudflare Workers
