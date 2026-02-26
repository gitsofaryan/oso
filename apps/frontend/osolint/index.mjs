import noDirectAdminClient from "./rules/access-control/no-direct-admin-client.mjs";
import enforceMiddlewareTier from "./rules/access-control/enforce-middleware-tier.mjs";
import noInlineResolverTypes from "./rules/type-safety/no-inline-resolver-types.mjs";
import explicitReturnTypes from "./rules/type-safety/explicit-return-types.mjs";

export default {
  rules: {
    "access-control/no-direct-admin-client": noDirectAdminClient,
    "access-control/enforce-middleware-tier": enforceMiddlewareTier,
    "type-safety/no-inline-resolver-types": noInlineResolverTypes,
    "type-safety/explicit-return-types": explicitReturnTypes,
  },
};
