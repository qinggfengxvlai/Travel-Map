# Map Lazy Loading Design

## Goal

Reduce initial map load weight by moving county details and food article details out of the first-page data path.

## Chosen Approach

Use a medium-scope lazy loading split:

- Keep the current visual behavior and route interactions.
- Load lightweight summaries on startup for search, article badges, and city-level counts.
- Load full county records and food article records only when a city detail view is opened.
- Keep existing on-demand loaders for metro networks, 12306 station names, and OSM station queries.

## Data Shape

Generated files:

- `data/counties-summary.json`: minimal global county search records.
- `data/counties/by-city/<cityId>.json`: full county records for one city.
- `data/wechat-food-summary.json`: minimal food article records for search and counts.
- `data/food-articles/by-city/<cityId>.json`: full food article records for one city.

The existing full files can remain for rebuild/debug workflows:

- `data/china-counties.json`
- `data/wechat-food-articles.json`

## Frontend Flow

Startup loads:

- `data/china-prefectures.json`
- `data/china-cities.json`
- `data/counties-summary.json`
- `data/wechat-food-summary.json`

City detail loads:

- `data/counties/by-city/<cityId>.json`
- `data/food-articles/by-city/<cityId>.json`

When a county is selected from search, the app loads that county's parent city chunk before entering city detail or creating a route segment.

## Fallbacks

If a summary or city chunk is missing, the app treats it as empty and continues rendering. Existing city points, route building, landmarks, metro data, and station fallbacks should keep working.

## Verification

- Rebuild lazy data.
- Verify JavaScript syntax.
- Verify startup still returns 200 from the local server.
- Verify a city with food articles can show article markers after entering city detail.
- Verify county search still works after lazy loading.
