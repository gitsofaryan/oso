import {
  viewerQueries,
  viewerTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/user/viewer";
import { runsQueries } from "@/app/api/v1/osograph/schema/resolvers/user/runs";
import {
  invitationQueries,
  invitationMutations,
} from "@/app/api/v1/osograph/schema/resolvers/user/invitation";
import { dataConnectionQueries } from "@/app/api/v1/osograph/schema/resolvers/user/data-connection";
import { datasetQueries } from "@/app/api/v1/osograph/schema/resolvers/user/dataset";
import { notebookQueries } from "@/app/api/v1/osograph/schema/resolvers/user/notebook";
import { organizationQueries } from "@/app/api/v1/osograph/schema/resolvers/user/organization";
import { dataModelQueries } from "@/app/api/v1/osograph/schema/resolvers/user/data-model";
import { staticModelQueries } from "@/app/api/v1/osograph/schema/resolvers/user/static-model";
import { userTypeResolvers } from "@/app/api/v1/osograph/schema/resolvers/user/user";

export const queries = {
  ...viewerQueries,
  ...runsQueries,
  ...invitationQueries,
  ...dataConnectionQueries,
  ...datasetQueries,
  ...notebookQueries,
  ...organizationQueries,
  ...dataModelQueries,
  ...staticModelQueries,
};

export const mutations = {
  ...invitationMutations,
};

export const typeResolvers = {
  ...viewerTypeResolvers,
  ...userTypeResolvers,
};
