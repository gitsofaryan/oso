---
title: OSO Graph API
sidebar_position: 10
---

# OSO Graph API Operations Guide

Guide for adding queries and mutations to OSOGraph.

# Schema & Resolver Architecture

The API follows **Relay's cursor-based pagination spec**. Every list query returns a Connection type.

**Key Principles:**

1. **Domain-Driven Schema**: Each resource has its own `.graphql` file in `schema/graphql/`. All files are merged at startup in `route.ts`.

2. **Connection Pattern**: All list queries return Connections, never arrays.

   ```
   Connection { edges: [{ node: T, cursor: String }], pageInfo: { ... }, totalCount: Int }
   ```

3. **Edge Types**: Edges wrap nodes with cursors. Define `{Type}Edge` and `{Type}Connection` for each resource.

4. **Field Resolvers**: Types can have field resolvers that load nested resources. These run lazily when the field is queried.

5. **Type Mapping**: Map database columns (`snake_case`) to GraphQL fields (`camelCase`) via field resolvers.

**Data Flow:**

```
Query → Auth Check → Validate Where Clause → parseWhereClause() → mergePredicates() → buildQuery() → Supabase (with count) → buildConnectionOrEmpty() → { edges, pageInfo, totalCount }
```

## Directory Structure

```
frontend/app/api/v1/osograph/
├── route.ts                   # Apollo Server setup
├── schema/
│   ├── graphql/               # SDL type definitions
│   │   ├── base.graphql       # Base types, PageInfo, enums, JSON scalar
│   │   └── *.graphql          # Domain schemas
│   └── resolvers/             # Resolver implementations
│       ├── index.ts           # Combines all resolvers
│       ├── user/              # withAuthenticatedClient() → AuthenticatedClientContext
│       ├── organization/      # withOrgScopedClient(getOrgId) → OrgScopedContext
│       ├── resource/          # withOrgResourceClient(type,getId,perm) → ResourceScopedContext
│       └── system/            # withSystemClient() → SystemContext
├── types/
│   ├── context.ts             # GraphQL context
│   └── utils.ts               # Type utilities
└── utils/
    ├── auth.ts                # Auth helpers
    ├── connection.ts          # Connection builder
    ├── errors.ts              # Error helpers
    ├── pagination.ts          # Cursor pagination (constants & encoding)
    ├── query-builder.ts       # Builds Supabase queries from predicates
    ├── query-helpers.ts       # High-level query helpers (queryWithPagination)
    ├── resolver-builder.ts    # createResolver, createResolversCollection
    ├── resolver-helpers.ts    # Shared resolver utilities
    ├── resolver-middleware.ts # Middleware factories (withAuthenticatedClient, etc.)
    ├── validation.ts          # Zod schemas & input validation
    └── where-parser.ts        # Parses GraphQL where input to predicates
```

## Middleware Tiers

Resolvers are organized into four tiers. Each tier applies a specific middleware that sets up the Supabase client and attaches access-control context. Choose the right tier based on what the resolver needs:

| Directory       | Middleware                                 | Context additions                                              |
| --------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `user/`         | `withAuthenticatedClient()`                | `client`, `userId`, `orgIds`, `authenticatedUser`              |
| `organization/` | `withOrgScopedClient(getOrgId)`            | `client`, `orgId`, `orgRole`, `userId`, `authenticatedUser`    |
| `resource/`     | `withOrgResourceClient(type, getId, perm)` | `client`, `resourceId`, `permissionLevel`, `authenticatedUser` |
| `system/`       | `withSystemClient()`                       | `client`                                                       |

**Rules:**

- `withValidation()` must come **before** any access-control middleware
- Never call `createAdminClient()` in resolver files — always use `context.client`
- Queries live in `user/*/queries.ts` (scoped to the authenticated user's orgs)
- Mutations live in `resource/*/mutations.ts` or `organization/*/mutations.ts`
- Type-resolvers live in `resource/*/type-resolvers.ts`

## Adding a Query

### Example: Widget Resource

**1. Define Schema** (`schema/graphql/widget.graphql`)

````graphql
type Widget {
  id: ID!
  name: String!
  orgId: ID!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type WidgetEdge {
  node: Widget!
  cursor: String!
}

type WidgetConnection {
  edges: [WidgetEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}

extend type Query {
  """
  Query widgets with optional filtering and pagination.

  The where parameter accepts a JSON object with field-level filtering.
  Each field can have comparison operators: eq, neq, gt, gte, lt, lte, in, like, ilike, is.

  Example:
  ```json
  {
    "name": { "like": "%search%" },
    "created_at": { "gte": "2024-01-01T00:00:00Z" }
  }
  ```
  """
  widgets(where: JSON, first: Int = 50, after: String): WidgetConnection!
}
````

:::tip
To query a single widget, use filtering:

```graphql
widgets(where: { id: { eq: "widget_id" } })
```

:::

**2. Implement Resolver** (`schema/resolvers/user/widget/queries.ts`)

```typescript
import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";
import {
  type ExplicitClientQueryOptions,
  queryWithPagination,
} from "@/app/api/v1/osograph/utils/query-helpers";
import { WidgetWhereSchema } from "@/app/api/v1/osograph/utils/validation";

export const widgetQueries: Pick<QueryResolvers, "widgets"> = {
  widgets: createResolver<QueryResolvers, "widgets">()
    .use(withAuthenticatedClient())
    .resolve(async (_, args, context) => {
      const options: ExplicitClientQueryOptions<"widgets"> = {
        client: context.client,
        orgIds: context.orgIds,
        tableName: "widgets",
        whereSchema: WidgetWhereSchema,
        basePredicate: {
          is: [{ key: "deleted_at", value: null }],
        },
      };
      return queryWithPagination(args, context, options);
    }),
};
```

**3. Register**

Schema files (`.graphql`) are **automatically discovered** by `route.ts`.

Add the query to `schema/resolvers/user/index.ts`:

```typescript
import { widgetQueries } from "@/app/api/v1/osograph/schema/resolvers/user/widget";

export const queries = {
  // ... existing queries
  ...widgetQueries,
};
```

This automatically flows to `resolvers/index.ts` via `userQueries`.

## Adding a Mutation

**1. Define Schema** (`schema/graphql/widget.graphql`)

```graphql
input UpdateWidgetInput {
  widgetId: ID!
  name: String
}

type UpdateWidgetPayload {
  success: Boolean!
  widget: Widget
  message: String
}

extend type Mutation {
  updateWidget(input: UpdateWidgetInput!): UpdateWidgetPayload!
}
```

**2. Create Validation Schema** (in `types/generated/validation.ts` via codegen, or manually in `utils/validation.ts`)

```typescript
import { z } from "zod";

export const UpdateWidgetInputSchema = () =>
  z.object({
    widgetId: z.string().uuid(),
    name: z.string().min(1).nullish(),
  });
```

**3. Implement Resolver** (`schema/resolvers/resource/widget/mutations.ts`)

```typescript
import { ServerErrors } from "@/app/api/v1/osograph/utils/errors";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withOrgResourceClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import { UpdateWidgetInputSchema } from "@/app/api/v1/osograph/utils/validation";

type WidgetMutationResolvers = Pick<
  Required<MutationResolvers>,
  "updateWidget"
>;

export const widgetMutations =
  createResolversCollection<WidgetMutationResolvers>()
    .defineWithBuilder("updateWidget", (builder) =>
      builder
        .use(withValidation(UpdateWidgetInputSchema())) // 1st: validate
        .use(
          withOrgResourceClient(
            "widgets",
            ({ args }) => args.input.widgetId,
            "write",
          ),
        )
        .resolve(async (_, { input }, context) => {
          const { data, error } = await context.client
            .from("widgets")
            .update({ name: input.name })
            .eq("id", input.widgetId)
            .select()
            .single();

          if (error) throw ServerErrors.database("Failed to update widget");
          return { success: true, widget: data };
        }),
    )
    .resolvers();
```

**4. Register**

Add to `schema/resolvers/resource/index.ts`:

```typescript
import { widgetMutations, widgetTypeResolvers } from "./widget";

export const mutations = {
  // ... existing mutations
  ...widgetMutations,
};
```

## Adding Type-Resolvers

Type-resolvers map database columns (`snake_case`) to GraphQL fields (`camelCase`) and load nested resources. They live in `resource/*/type-resolvers.ts`.

**Simple field mapping** — no middleware needed, just return the column value:

```typescript
Widget: {
  orgId: (parent) => parent.org_id,
  createdAt: (parent) => parent.created_at,
  updatedAt: (parent) => parent.updated_at,
},
```

**Nested/connection field** — use `createResolver` with `withOrgResourceClient` to enforce access control:

```typescript
import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withOrgResourceClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { WidgetResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { queryWithPagination } from "@/app/api/v1/osograph/utils/query-helpers";
import { WidgetRevisionWhereSchema } from "@/app/api/v1/osograph/utils/validation";

Widget: {
  orgId: (parent) => parent.org_id,
  createdAt: (parent) => parent.created_at,

  revisions: createResolver<WidgetResolvers, "revisions">()
    .use(withOrgResourceClient("widgets", ({ parent }) => parent.id, "read"))
    .resolve(async (parent, args, context) =>
      queryWithPagination(args, context, {
        client: context.client,
        orgIds: parent.org_id,
        tableName: "widget_revisions",
        whereSchema: WidgetRevisionWhereSchema,
        basePredicate: {
          eq: [{ key: "widget_id", value: parent.id }],
        },
      }),
    ),
},
```

Register type-resolvers by spreading into `resource/index.ts`:

```typescript
export const typeResolvers = {
  // ... existing type resolvers
  ...widgetTypeResolvers,
};
```

## Filtering with Where Clauses

List queries support flexible filtering via the `where` parameter, which accepts a JSON object specifying field-level filters.

:::warning
Field names in `where` filters **must use snake_case** (database column names), not camelCase (GraphQL field names). This is a known limitation due to the current 1:1 mapping with Supabase.

For example, use `notebook_name` instead of `notebookName`, and `created_at` instead of `createdAt`.
:::

### Filter Structure

```json
{
  "field_name": { "operator": value },
  "another_field": { "operator": value }
}
```

Multiple operators can be applied to the same field:

```json
{
  "created_at": {
    "gte": "2024-01-01T00:00:00Z",
    "lt": "2024-12-31T23:59:59Z"
  }
}
```

### Supported Operators

| Operator | Description                      | Example                                     |
| -------- | -------------------------------- | ------------------------------------------- |
| `eq`     | Equals                           | `{ "status": { "eq": "active" } }`          |
| `neq`    | Not equals                       | `{ "status": { "neq": "deleted" } }`        |
| `gt`     | Greater than                     | `{ "count": { "gt": 100 } }`                |
| `gte`    | Greater than or equal            | `{ "created_at": { "gte": "2024-01-01" } }` |
| `lt`     | Less than                        | `{ "count": { "lt": 1000 } }`               |
| `lte`    | Less than or equal               | `{ "updated_at": { "lte": "2024-12-31" } }` |
| `in`     | In array                         | `{ "id": { "in": ["id1", "id2", "id3"] } }` |
| `like`   | Pattern match (case-sensitive)   | `{ "name": { "like": "%search%" } }`        |
| `ilike`  | Pattern match (case-insensitive) | `{ "email": { "ilike": "%@example.com" } }` |
| `is`     | Null/boolean check               | `{ "deleted_at": { "is": null } }`          |

:::note

- `like` and `ilike` use SQL wildcards: `%` (any characters), `_` (single character)
- `in` accepts an array of values
- `is` accepts `null` or boolean values
  :::

### GraphQL Query Examples

**Single resource by ID:**

```graphql
query {
  notebooks(where: { id: { eq: "123e4567-e89b-12d3-a456-426614174000" } }) {
    edges {
      node {
        id
        name
      }
    }
  }
}
```

**Filter by name pattern:**

```graphql
query {
  notebooks(where: { notebook_name: { like: "%churn%" } }) {
    edges {
      node {
        id
        name
      }
    }
  }
}
```

**Filter by date range:**

```graphql
query {
  datasets(
    where: {
      created_at: { gte: "2024-01-01T00:00:00Z", lt: "2024-12-31T23:59:59Z" }
    }
  ) {
    edges {
      node {
        id
        name
        createdAt
      }
    }
  }
}
```

**Multiple field filters:**

```graphql
query {
  dataModels(
    where: {
      name: { ilike: "%user%" }
      is_enabled: { eq: true }
      created_at: { gte: "2024-01-01T00:00:00Z" }
    }
  ) {
    edges {
      node {
        id
        name
        isEnabled
      }
    }
  }
}
```

**Combine with pagination:**

```graphql
query {
  notebooks(
    where: { notebook_name: { like: "%analysis%" } }
    first: 20
    after: "cursor123"
  ) {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

### Using the `queryWithPagination` Helper

For the common use case of querying a single table with pagination, filtering, and org-scoped access control, use the `queryWithPagination` helper. This abstracts away all the boilerplate of validating where clauses, building predicates, and executing queries.

The middleware tier handles authentication and org-scoping — pass `client` and `orgIds` explicitly from context:

**Top-level user query** (inside `withAuthenticatedClient()` resolver):

```typescript
return queryWithPagination(args, context, {
  client: context.client,
  orgIds: context.orgIds, // ← from AuthenticatedClientContext
  tableName: "notebooks",
  whereSchema: NotebookWhereSchema,
  basePredicate: {
    is: [{ key: "deleted_at", value: null }],
  },
});
```

**Nested resource in a type-resolver** (inside `withOrgResourceClient()` resolver):

```typescript
// In DataModel type resolver — revisions field
return queryWithPagination(args, context, {
  client: context.client,
  orgIds: parent.org_id, // ← use parent's org_id directly
  tableName: "model_revision",
  whereSchema: DataModelRevisionWhereSchema,
  basePredicate: {
    eq: [{ key: "model_id", value: parent.id }],
  },
});
```

**Helper Options (explicit-client form):**

| Option          | Type                 | Description                                                  |
| --------------- | -------------------- | ------------------------------------------------------------ |
| `client`        | `SupabaseClient`     | The authenticated client from context                        |
| `orgIds`        | `string \| string[]` | Org ID(s) to scope the query to                              |
| `tableName`     | `string`             | The database table to query                                  |
| `whereSchema`   | `ZodSchema`          | Validation schema for the where clause                       |
| `basePredicate` | `QueryPredicate`     | Additional system filters (e.g., soft delete, status checks) |
| `orderBy`       | `{ key, ascending }` | Optional sort order                                          |
| `errorMessage`  | `string`             | Optional custom error message                                |

The helper automatically handles:

- Organization access validation (scoped by `orgIds`)
- Where clause validation and parsing
- Predicate merging (system filters + user filters)
- Query building and execution
- Connection building with pagination
- Error handling

### Security Considerations

:::warning
System filters (access control, soft deletes) are **always enforced** and cannot be bypassed by user-provided `where` filters.
:::

```typescript
const basePredicate = {
  in: [{ key: "org_id", value: userOrgIds }], // ← Access control
  is: [{ key: "deleted_at", value: null }], // ← Soft delete filter
};
```

User-provided `where` filters are **merged** with system filters using `mergePredicates()`, ensuring:

- Users can only query resources in their organizations
- Soft-deleted resources are excluded
- Authorization checks are never bypassed

## Patterns

### Pagination & Filtering (Recommended)

For standard list queries with pagination and filtering, use the `queryWithPagination` helper. Pass `client` and `orgIds` from context (set by the middleware tier):

```typescript
return queryWithPagination(args, context, {
  client: context.client,
  orgIds: context.orgIds,
  tableName: "table_name",
  whereSchema: TableWhereSchema,
  basePredicate: {
    is: [{ key: "deleted_at", value: null }],
  },
});
```

### Manual Pagination (for custom queries)

When you need more control (e.g., complex joins, custom logic):

```typescript
const [start, end] = preparePaginationRange(args);
const { data, count } = await context.client
  .from("t")
  .select("*", { count: "exact" })
  .range(start, end);
return buildConnectionOrEmpty(data, args, count);
```

### Manual Filtering (for custom queries)

When `queryWithPagination` doesn't fit your use case:

```typescript
// Validate and parse where clause
const validatedWhere = args.where
  ? validateInput(createWhereSchema("table_name"), args.where)
  : undefined;

const userPredicate = validatedWhere
  ? parseWhereClause(validatedWhere)
  : undefined;

// Merge with system filters
const basePredicate = {
  eq: [{ key: "org_id", value: orgId }],
  is: [{ key: "deleted_at", value: null }],
};

const predicate = userPredicate
  ? mergePredicates(basePredicate, userPredicate)
  : basePredicate;

// Build and execute query
const { data, count, error } = await buildQuery(
  context.client,
  "table_name",
  predicate,
  (query) => query.range(start, end),
);
```

## Best Practices

**DO:**

- Pick the right middleware tier (see table above) — `user/` for queries, `resource/` for mutations and type-resolvers
- Put `withValidation()` **first** in the middleware chain, before any access-control middleware
- Use `context.client` — never call `createAdminClient()` in resolver files
- Use `createResolver<TResolvers, "fieldName">()` for type-safe individual resolvers
- Use `createResolversCollection<T>()` for grouping multiple mutations
- Use `queryWithPagination` for standard list queries (pagination + filtering + org-scoping)
- Use error helpers: `ResourceErrors.notFound()`, `ServerErrors.database()`
- Soft delete: `.is("deleted_at", null)` in `basePredicate`
- Return connections for lists: `buildConnectionOrEmpty(items, args, count)`
- Map DB columns in type-resolvers: `orgId: (parent) => parent.org_id`
- Return structured payloads from mutations: `{ success, resource, message }`
- Use generated Zod schemas from `types/generated/validation.ts` when available

**DON'T:**

- Call `createAdminClient()` in resolvers — use `context.client`
- Skip `withValidation()` for mutations that accept user input
- Put access-control middleware before `withValidation()`
- Expose raw Supabase errors — wrap them with `ServerErrors.database()`
- Hardcode pagination limits: use constants from `pagination.ts`
- Forget soft deletes in `basePredicate`
- Mix domain logic across resolvers
- Create custom connection types
- Bypass system filters when merging predicates

**Naming:**

- Queries: `resource`, `resources`
- Mutations: `createResource`, `updateResource`
- Input: `{Action}{Resource}Input`
- Payload: `{Action}{Resource}Payload`

## Error Helpers

```typescript
// Auth
AuthenticationErrors.notAuthenticated();
AuthenticationErrors.notAuthorized();

// Resources
ResourceErrors.notFound("Widget", id);
ResourceErrors.alreadyExists("Widget", name);

// Validation
ValidationErrors.invalidInput("field", "reason");
ValidationErrors.missingField("field");

// Server
ServerErrors.database(message);
ServerErrors.internal(message);
```

## Debugging

- Apollo Sandbox: `/api/v1/graphql` (change graph URL to `/api/v1/osograph`)
- Error stack traces: enabled in `dev`
- Check schema loading: verify file in `schemaFiles` array
