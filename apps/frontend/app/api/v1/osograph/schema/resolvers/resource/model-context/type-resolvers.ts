import type { Resolvers } from "@/app/api/v1/osograph/types/generated/types";

export const modelContextTypeResolvers: Pick<Resolvers, "ModelContext"> = {
  ModelContext: {
    orgId: (parent) => parent.org_id,
    datasetId: (parent) => parent.dataset_id,
    tableId: (parent) => parent.table_id,
    context: (parent) => parent.context,
    columnContext: (parent) => parent.column_context,
    createdAt: (parent) => parent.created_at,
    updatedAt: (parent) => parent.updated_at,
  },
};
