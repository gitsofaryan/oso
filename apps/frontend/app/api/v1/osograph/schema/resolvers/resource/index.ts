import {
  notebookMutations,
  notebookTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/resource/notebook";
import {
  datasetMutations,
  datasetTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/resource/dataset";
import {
  dataModelMutations,
  dataModelTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/resource/data-model";
import {
  staticModelMutations,
  staticModelTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/resource/static-model";
import {
  dataIngestionMutations,
  dataIngestionTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/resource/data-ingestion";
import {
  dataConnectionMutations,
  dataConnectionTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/resource/data-connection";
import {
  modelContextMutations,
  modelContextTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/resource/model-context";
import { permissionMutations } from "@/app/api/v1/osograph/schema/resolvers/resource/permissions";

export const mutations = {
  ...permissionMutations,
  ...notebookMutations,
  ...datasetMutations,
  ...dataModelMutations,
  ...staticModelMutations,
  ...dataIngestionMutations,
  ...dataConnectionMutations,
  ...modelContextMutations,
};

export const typeResolvers = {
  ...notebookTypeResolvers,
  ...datasetTypeResolvers,
  ...dataModelTypeResolvers,
  ...staticModelTypeResolvers,
  ...dataIngestionTypeResolvers,
  ...dataConnectionTypeResolvers,
  ...modelContextTypeResolvers,
};
