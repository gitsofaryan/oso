import { query } from "@/lib/clients/apollo-app";
import { MarketplaceContent } from "@/app/beta/[orgName]/marketplace/_components/marketplace-content";
import { RESOLVE_ORGANIZATION } from "@/app/beta/[orgName]/marketplace/_graphql/queries";
import { notFound } from "next/navigation";
import { logger } from "@/lib/logger";

export default async function MarketplacePage({
  params,
}: {
  params: { orgName: string };
}) {
  // Resolve organization on the server
  const { data: orgData, error } = await query({
    query: RESOLVE_ORGANIZATION,
    variables: {
      where: { org_name: { eq: params.orgName } },
    },
    errorPolicy: "all",
  });

  const orgId = orgData?.organizations?.edges?.[0]?.node?.id;

  if (!orgId || error) {
    logger.error("Failed to resolve organization for marketplace page:", {
      orgName: params.orgName,
      error,
    });
    notFound();
  }

  return <MarketplaceContent orgId={orgId} />;
}
