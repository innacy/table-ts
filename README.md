# @cnips/table

A typed TypeScript client for accessing tables in a [cnips](https://cnips.io) instance over HTTP.

The package exposes a `TableAccessor<T>` interface and a concrete `CnipsTableAccessor<T>` class that maps TypeScript objects to rows in a cnips table.

## Installation

```bash
npm install @cnips/table
```

## Quick Start

```typescript
import { CnipsTableAccessor } from "@cnips/table";

interface User {
  name: string;
  email: string;
  age: number;
}

const accessor = new CnipsTableAccessor<User>(
  "https://your-cnips-instance.com",
  "your-api-key"
);
const tableId = "users-table-id";

// Insert a single row
await accessor.insert(tableId, { name: "Ada", email: "ada@example.com", age: 36 });

// Bulk insert
await accessor.bulkInsert(tableId, [
  { name: "Alan", email: "alan@example.com", age: 41 },
  { name: "Grace", email: "grace@example.com", age: 85 },
]);

// Find rows matching a query
const users = await accessor.find(tableId, { name: "Ada" });
console.log(`found ${users.length} users`);

// Get total count of rows
const total = await accessor.count(tableId, {});
console.log(`table has ${total} total rows`);

// Update rows matching a query
const updated = await accessor.update(
  tableId,
  { name: "Ada" },
  { name: "Ada", email: "ada@new.example.com", age: 37 }
);

// Delete rows matching a query
await accessor.delete(tableId, { name: "Ada" });
```

## Configuration

```typescript
const accessor = new CnipsTableAccessor<User>(
  "https://your-cnips-instance.com",
  "your-api-key",
  {
    timeoutMs: 10_000,       // default: 60000
    fetchFn: customFetch,    // default: globalThis.fetch
  }
);
```

## API

| Method                                        | Description                                                |
| --------------------------------------------- | ---------------------------------------------------------- |
| `insert(tableId, data, options?)`             | Insert a single row.                                       |
| `bulkInsert(tableId, data[], options?)`       | Insert multiple rows in one request.                       |
| `find(tableId, query, options?)`              | Search rows matching the filter map.                       |
| `count(tableId, query, options?)`             | Get total number of rows matching the filter.              |
| `update(tableId, query, data, options?)`      | Update rows matching the filter; returns the updated rows. |
| `delete(tableId, query, options?)`            | Delete rows matching the filter.                           |

### Pagination (FindOptions)

You can pass an optional `FindOptions` to control pagination:

```typescript
interface FindOptions extends RequestOptions {
  size?: number; // Rows per page (1–10000). Server default: 10.
  page?: number; // Zero-based page index. Server default: 0.
}
```

> **Note:** Without `FindOptions`, the server returns at most **10 rows** (the default page size). The maximum allowed size is **10000**.

Use `count()` to get the total number of matching rows, then paginate with `find()`:

```typescript
// Get total count
const total = await accessor.count(tableId, { department: "IT" });
console.log(`${total} total rows`);

// Paginate through all results
const pageSize = 50;
for (let page = 0; page * pageSize < total; page++) {
  const rows = await accessor.find(tableId, { department: "IT" }, { size: pageSize, page });
  // process rows...
}

// Or fetch up to 10000 rows at once
const all = await accessor.find(tableId, {}, { size: 10000 });
```

### HTTP endpoints used

- `POST /tables/{tableId}/rows` — insert / bulk insert
- `POST /tables/{tableId}/rows/search?size=N&page=N` — find
- `PUT  /tables/{tableId}/rows` — update
- `DELETE /tables/{tableId}/rows` — delete

Authentication uses the `X-API-Key` header.

## License

See repository for license information.
