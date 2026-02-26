import { notebookMutations } from "@/app/api/v1/osograph/schema/resolvers/organization/notebook";
import { datasetMutations } from "@/app/api/v1/osograph/schema/resolvers/organization/dataset";
import { dataModelMutations } from "@/app/api/v1/osograph/schema/resolvers/organization/data-model";
import { staticModelMutations } from "@/app/api/v1/osograph/schema/resolvers/organization/static-model";
import { dataConnectionMutations } from "@/app/api/v1/osograph/schema/resolvers/organization/data-connection";
import {
  runMutations,
  runTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/organization/run";
import {
  organizationMemberMutations,
  organizationTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/organization/organization";
import {
  invitationMutations,
  invitationTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/organization/invitation";
import { stepTypeResolvers } from "@/app/api/v1/osograph/schema/resolvers/organization/step";
import { materializationTypeResolvers } from "@/app/api/v1/osograph/schema/resolvers/organization/materialization";

export const mutations = {
  ...notebookMutations,
  ...datasetMutations,
  ...dataModelMutations,
  ...staticModelMutations,
  ...dataConnectionMutations,
  ...runMutations,
  ...organizationMemberMutations,
  ...invitationMutations,
};

export const typeResolvers = {
  ...organizationTypeResolvers,
  ...invitationTypeResolvers,
  ...runTypeResolvers,
  ...stepTypeResolvers,
  ...materializationTypeResolvers,
};
