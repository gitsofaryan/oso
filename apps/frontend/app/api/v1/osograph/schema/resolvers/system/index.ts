import { runMutations } from "@/app/api/v1/osograph/schema/resolvers/system/run";
import { stepMutations } from "@/app/api/v1/osograph/schema/resolvers/system/step";
import { materializationMutations } from "@/app/api/v1/osograph/schema/resolvers/system/materialization";
import { notebookMutations } from "@/app/api/v1/osograph/schema/resolvers/system/notebook";
import { dataConnectionMutations } from "@/app/api/v1/osograph/schema/resolvers/system/data-connection";
import {
  systemQueries,
  systemTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/system/system";

export const queries = {
  ...systemQueries,
};

export const mutations = {
  ...runMutations,
  ...stepMutations,
  ...materializationMutations,
  ...notebookMutations,
  ...dataConnectionMutations,
};

export const typeResolvers = {
  ...systemTypeResolvers,
};
