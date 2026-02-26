# no-direct-admin-client

Blocks direct `createAdminClient` imports in `resolvers/system/`,
`resolvers/user/`, `resolvers/organization/`, and `resolvers/resource/` directories.

## Why

Enforces access control through middleware instead of direct database access.
The `with*` middleware factories encapsulate the correct client setup and
permission checks for each resolver tier.

## Use Instead

```typescript
// Bad
import { createAdminClient } from "@/lib/supabase/admin";

// Good — use with* middleware in your resolver chain
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";

createResolver<QueryResolvers, "widgets">()
  .use(withAuthenticatedClient())
  .resolve(async (_, args, context) => {
    // context.client is provided by the middleware
  });
```

## Available Middleware

- `withSystemClient()` - System operations (use in `system/`)
- `withAuthenticatedClient()` - User-scoped operations (use in `user/`)
- `withOrgScopedClient(getOrgId)` - Org-scoped operations (use in `organization/`)
- `withOrgResourceClient(type, getId, perm)` - Org and resource-scoped operations (use in `resource/`)
