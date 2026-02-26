import { DBTableResolver } from "@/lib/query/resolvers/db-table-resolver";
import { Table } from "@/lib/types/table";
import {
  setup,
  teardown,
  ResolverFixtureData,
} from "@/lib/query/resolvers/resolver-test-fixture";

describe("DBTableResolver", () => {
  let fixture: ResolverFixtureData;

  beforeAll(async () => {
    fixture = await setup();
  }, 30000);

  afterAll(async () => {
    await teardown(fixture);
  });

  describe("resolveTables", () => {
    it("resolves a table correctly", async () => {
      const resolver = new DBTableResolver(fixture.adminSupabase, []);

      const resolvedTables = await resolver.resolveTables(
        {
          "some.random.table": Table.fromString(
            `${fixture.orgs.org_a.name}.user.alpha`,
          ),
        },
        {},
      );

      const resolvedTable = resolvedTables["some.random.table"];

      // Check that this resolves to a table in the format we expect
      expect(
        resolvedTable.toFQN().startsWith(`org_${fixture.orgs.org_a.id}`),
      ).toBe(true);

      // Check that the dataset is one of the available datasets for org_a
      const datasetIdsForOrgA = fixture.orgDatasets["org_a"];
      const datasetIdInResolvedTable = resolvedTable.dataset.split("_")[1];
      expect(datasetIdsForOrgA).toContain(datasetIdInResolvedTable);

      // Check that the table_id is in the expected format
      const tableIdInResolvedTable = resolvedTable.table;
      expect(tableIdInResolvedTable.startsWith("model_")).toBe(true);
    });

    it("resolves multiple tables without duplication", async () => {
      const resolver = new DBTableResolver(fixture.adminSupabase, []);

      const resolvedTables = await resolver.resolveTables(
        {
          table_00: Table.fromString(`${fixture.orgs.org_a.name}.user.alpha`),
          table_01: Table.fromString(`${fixture.orgs.org_b.name}.user.alpha`),
          table_02: Table.fromString(`${fixture.orgs.org_c.name}.user.alpha`),
          table_03: Table.fromString(`${fixture.orgs.org_d.name}.user.alpha`),
          table_04: Table.fromString(`${fixture.orgs.org_e.name}.user.alpha`),
          table_05: Table.fromString(`${fixture.orgs.org_a.name}.user.bravo`),
          table_06: Table.fromString(`${fixture.orgs.org_b.name}.user.bravo`),
          table_07: Table.fromString(`${fixture.orgs.org_c.name}.user.bravo`),
          table_08: Table.fromString(`${fixture.orgs.org_d.name}.user.bravo`),
          table_09: Table.fromString(`${fixture.orgs.org_e.name}.user.bravo`),
          table_10: Table.fromString(`${fixture.orgs.org_a.name}.user.charlie`),
          table_11: Table.fromString(`${fixture.orgs.org_b.name}.user.charlie`),
          table_12: Table.fromString(`${fixture.orgs.org_c.name}.user.charlie`),
          table_13: Table.fromString(`${fixture.orgs.org_d.name}.user.charlie`),
          table_14: Table.fromString(`${fixture.orgs.org_e.name}.user.charlie`),
        },
        {},
      );

      // Ensure all tables are resolved and all unique (this is a sanity check
      // that our test logic isn't creating duplicate references)
      const seenTableFQNs: Set<string> = new Set();
      for (const [_, table] of Object.entries(resolvedTables)) {
        expect(table).toBeDefined();
        const fqn = table.toFQN();
        expect(seenTableFQNs.has(fqn)).toBe(false);
        seenTableFQNs.add(fqn);
      }
    });

    it("doesn't throw an error for unresolvable tables", async () => {
      const resolver = new DBTableResolver(fixture.adminSupabase, []);

      const resolvedTables = await resolver.resolveTables(
        {
          valid_table: Table.fromString(
            `${fixture.orgs.org_a.name}.user.alpha`,
          ),
          invalid_table: Table.fromString(`nonexistent.org.nothing`),
        },
        {},
      );
      expect(resolvedTables["valid_table"]).toBeDefined();
      expect(resolvedTables["invalid_table"]).toBeUndefined();
    });
  });
});
