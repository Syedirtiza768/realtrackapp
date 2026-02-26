# RealTrackApp Backend (NestJS + PostgreSQL)

This backend ingests eBay `Listings` rows (including `Custom Label (SKU)`) from the workbook set in:

`../files/_same_structure_as_B20_eBay_Verified_2-Oct`

and stores them in PostgreSQL.

## 1) Setup

```bash
npm install
```

Create your env file:

```bash
cp .env.example .env
```

Update DB values in `.env`:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SYNC=true` (auto-creates tables for local development)

## 2) Run API

```bash
npm run start:dev
```

Server starts on `http://localhost:3000` and API prefix is `/api`.

## 3) Import listings into Postgres

```bash
npm run import:listings
```

Or trigger import through HTTP:

```bash
POST /api/listings/import
```

## 4) Query endpoints

- `GET /` health check
- `GET /api/listings/summary`
- `GET /api/listings?limit=100&offset=0&search=BU1984`

## Notes

- Source sheet expected: `Listings`
- Marker expected in sheet values: `Custom Label (SKU)`
- Import upserts by `(sourceFileName, sheetName, sourceRowNumber)` to prevent duplicate rows on re-import.
