import { ESLintUtils } from "@typescript-eslint/utils";
import path from "node:path";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/opensource-observer/oso/blob/main/apps/frontend/osolint/docs/${name}.md`,
);

const RESOLVER_BASE = "app/api/v1/osograph/schema/resolvers/";
const MIDDLEWARE_IMPORTS = new Set([
  "@/app/api/v1/osograph/utils/resolver-middleware",
  "@/app/api/v1/osograph/utils/resolver-middleware.ts",
]);

const TIER_MIDDLEWARE = {
  system: { allowed: new Set(["withSystemClient"]) },
  user: { allowed: new Set(["withAuthenticatedClient"]) },
  organization: { allowed: new Set(["withOrgScopedClient"]) },
  resource: { allowed: new Set(["withOrgResourceClient"]) },
};

const ALL_TIER_MIDDLEWARE = new Set(
  Object.values(TIER_MIDDLEWARE).flatMap((config) => [...config.allowed]),
);

const normalizePath = (filename) => filename.split(path.sep).join("/");

const detectTier = (normalizedPath) =>
  Object.keys(TIER_MIDDLEWARE).find((tier) =>
    normalizedPath.includes(`${RESOLVER_BASE}${tier}/`),
  );

const isMiddlewareImport = (node) =>
  node.source.type === "Literal" && MIDDLEWARE_IMPORTS.has(node.source.value);

const getTierMiddlewareSpecifiers = (node) =>
  node.specifiers
    .filter(
      (spec) =>
        spec.type === "ImportSpecifier" &&
        spec.imported.type === "Identifier" &&
        ALL_TIER_MIDDLEWARE.has(spec.imported.name),
    )
    .map((spec) => ({ name: spec.imported.name, node: spec }));

export default createRule({
  name: "enforce-middleware-tier",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce middleware tier separation - each resolver directory uses only its designated with* middleware",
    },
    messages: {
      wrongMiddleware:
        "'{{middleware}}' cannot be used in resolvers/{{tier}}/ directory. Use {{allowed}} instead.",
    },
    schema: [],
  },
  defaultOptions: [],

  create(context) {
    const filename = context.filename ?? context.getFilename();
    const normalizedPath = normalizePath(filename);
    const tier = detectTier(normalizedPath);

    if (!tier) return {};

    const { allowed } = TIER_MIDDLEWARE[tier];

    return {
      ImportDeclaration(node) {
        if (!isMiddlewareImport(node)) return;

        getTierMiddlewareSpecifiers(node).forEach(({ name, node: specNode }) => {
          if (!allowed.has(name)) {
            context.report({
              node: specNode,
              messageId: "wrongMiddleware",
              data: {
                middleware: name,
                tier,
                allowed: [...allowed].join(", "),
              },
            });
          }
        });
      },
    };
  },
});
