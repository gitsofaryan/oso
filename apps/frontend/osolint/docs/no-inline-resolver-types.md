# no-inline-resolver-types

Prevents inline type annotations in GraphQL resolver parameters. Requires using generated types for consistency and type safety.

## Rule Details

This rule enforces:

- Parent parameters must use Row types from `@/lib/types/schema`
- Args parameters must not use inline object types

## Examples

### Incorrect

```typescript
// Inline type for args parameter
export const invitationMutations = {
  createInvitation: async (
    _: unknown,
    args: { input: { orgId: string; email: string; role: string } },
    context: GraphQLContext,
  ) => {
    // ...
  },
};

// Inline type for parent parameter
export const notebookTypeResolvers = {
  Notebook: {
    name: (parent: { notebook_name: string }) => parent.notebook_name,
  },
};
```

### Correct

In the builder pattern, args types are inferred automatically from the
`createResolver<TResolvers, "fieldName">()` generic — no manual annotation needed:

```typescript
import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import type { MutationResolvers } from "@/lib/graphql/generated/graphql";

// Args type is inferred from the MutationResolvers["createInvitation"] generic
createResolver<MutationResolvers, "createInvitation">()
  .use(withOrgScopedClient(...))
  .resolve(async (_, args, context) => {
    // args is fully typed — no import needed
  });
```

For type resolvers, use Row types from the database schema for the parent:

```typescript
import { NotebooksRow } from "@/lib/types/schema";

export const notebookTypeResolvers = {
  Notebook: {
    name: (parent: NotebooksRow) => parent.notebook_name,
  },
};
```

## Common Type Mappings

### Args Types

In the builder pattern, args are typed automatically via
`createResolver<TResolvers, "fieldName">()` generics. You do **not** need to
import `Mutation*Args` or `Query*Args` types separately when using the builder.

If you are writing a plain resolver function outside the builder (rare), use
the generated types:

- `createInvitation` → `MutationCreateInvitationArgs`
- `revokeInvitation` → `MutationRevokeInvitationArgs`
- `createDataset` → `MutationCreateDatasetArgs`
- `updateNotebook` → `MutationUpdateNotebookArgs`
- `getDataset` → `QueryGetDatasetArgs`
- `listNotebooks` → `QueryListNotebooksArgs`

### Parent Types (from database)

- `Organization` → `OrganizationsRow`
- `Dataset` → `DatasetsRow`
- `Notebook` → `NotebooksRow`
- `Invitation` → `InvitationsRow`

All types are auto-generated from GraphQL schema or database schema.

## Scope

This rule only applies to files in:

- `app/api/v1/osograph/schema/resolvers/system/`
- `app/api/v1/osograph/schema/resolvers/user/`
- `app/api/v1/osograph/schema/resolvers/organization/`
- `app/api/v1/osograph/schema/resolvers/resource/`
