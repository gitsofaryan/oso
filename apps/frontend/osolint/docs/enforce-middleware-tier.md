# enforce-middleware-tier

Enforces strict tier separation: each resolver directory uses only its designated
`with*` middleware function from `resolver-middleware.ts`.

## Rules

**In `resolvers/system/`:**

- Allowed: `withSystemClient`
- Blocked: `withAuthenticatedClient`, `withOrgScopedClient`, `withOrgResourceClient`

**In `resolvers/user/`:**

- Allowed: `withAuthenticatedClient`
- Blocked: `withSystemClient`, `withOrgScopedClient`, `withOrgResourceClient`

**In `resolvers/organization/`:**

- Allowed: `withOrgScopedClient`
- Blocked: `withSystemClient`, `withAuthenticatedClient`, `withOrgResourceClient`

**In `resolvers/resource/`:**

- Allowed: `withOrgResourceClient`
- Blocked: `withSystemClient`, `withAuthenticatedClient`, `withOrgScopedClient`

Cross-cutting middleware (`withValidation`, `withLogging`) is always allowed in any tier.

## Examples

```typescript
// In resolvers/system/
import { withSystemClient } from "@/app/api/v1/osograph/utils/resolver-middleware";

// In resolvers/user/
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";

// In resolvers/organization/
import { withOrgScopedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";

// In resolvers/resource/
import { withOrgResourceClient } from "@/app/api/v1/osograph/utils/resolver-middleware";

// In any tier — always allowed
import {
  withValidation,
  withLogging,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
```
