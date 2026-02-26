import { Table } from "@/lib/types/table";
import { PermissionsResolver } from "@/lib/query/resolvers/permissions-resolver";
import { PermissionError } from "@/lib/types/errors";
import {
  setup,
  teardown,
  ResolverFixtureData,
} from "@/lib/query/resolvers/resolver-test-fixture";

describe("PermissionsResolver", () => {
  let fixture: ResolverFixtureData;

  beforeAll(async () => {
    fixture = await setup();
  }, 30000);

  afterAll(async () => {
    await teardown(fixture);
  });

  it("should pass through tables owned by the requesting org", async () => {
    const resolver = new PermissionsResolver(fixture.adminSupabase, []);
    const resolved = await resolver.resolveTables(
      {
        table1: Table.fromString(`${fixture.orgs.org_a.name}.user.alpha`),
      },
      { orgName: fixture.orgs.org_a.name },
    );
    expect(resolved).toEqual({
      table1: new Table(fixture.orgs.org_a.name, "user", "alpha"),
    });
  });

  it("should allow cross-org access when permission exists", async () => {
    const resolver = new PermissionsResolver(fixture.adminSupabase, []);
    const resolved = await resolver.resolveTables(
      {
        table1: Table.fromString(`${fixture.orgs.org_b.name}.user.alpha`),
      },
      { orgName: fixture.orgs.org_a.name },
    );
    expect(resolved).toEqual({
      table1: new Table(fixture.orgs.org_b.name, "user", "alpha"),
    });
  });

  it("should throw PermissionError for cross-org access without permission", async () => {
    const resolver = new PermissionsResolver(fixture.adminSupabase, []);
    await expect(
      resolver.resolveTables(
        {
          table1: Table.fromString(`${fixture.orgs.org_d.name}.user.alpha`),
        },
        { orgName: fixture.orgs.org_a.name },
      ),
    ).rejects.toThrow(PermissionError);
  });

  it("should not honor revoked permissions", async () => {
    const resolver = new PermissionsResolver(fixture.adminSupabase, []);
    await expect(
      resolver.resolveTables(
        {
          table1: Table.fromString(`${fixture.orgs.org_c.name}.user.alpha`),
        },
        { orgName: fixture.orgs.org_a.name },
      ),
    ).rejects.toThrow(PermissionError);
  });

  it("should bypass permission checks for legacy rules", async () => {
    const legacyRule = (table: Table) => {
      if (table.catalog === "legacy_catalog") {
        return table;
      }
      return null;
    };
    const resolver = new PermissionsResolver(fixture.adminSupabase, [
      legacyRule,
    ]);
    const resolved = await resolver.resolveTables(
      {
        table1: Table.fromString("legacy_catalog.some_dataset.some_table"),
      },
      { orgName: fixture.orgs.org_a.name },
    );
    expect(resolved).toEqual({
      table1: new Table("legacy_catalog", "some_dataset", "some_table"),
    });
  });

  it("should throw PermissionError for non-FQN tables", async () => {
    const resolver = new PermissionsResolver(fixture.adminSupabase, []);
    await expect(
      resolver.resolveTables(
        {
          table1: Table.fromString("just_a_table"),
        },
        { orgName: fixture.orgs.org_a.name },
      ),
    ).rejects.toThrow(PermissionError);
  });

  it("should skip resolver and return tables unchanged for invalid metadata", async () => {
    const resolver = new PermissionsResolver(fixture.adminSupabase, []);
    const inputTable = Table.fromString("any.dataset.table");
    const resolved = await resolver.resolveTables(
      { table1: inputTable },
      { notOrgName: "something" },
    );
    expect(resolved).toEqual({
      table1: inputTable,
    });
  });

  it("should handle mixed same-org and cross-org tables when permissions exist", async () => {
    const resolver = new PermissionsResolver(fixture.adminSupabase, []);
    const resolved = await resolver.resolveTables(
      {
        own_table: Table.fromString(`${fixture.orgs.org_a.name}.user.alpha`),
        cross_table: Table.fromString(`${fixture.orgs.org_b.name}.user.bravo`),
      },
      { orgName: fixture.orgs.org_a.name },
    );
    expect(resolved).toEqual({
      own_table: new Table(fixture.orgs.org_a.name, "user", "alpha"),
      cross_table: new Table(fixture.orgs.org_b.name, "user", "bravo"),
    });
  });

  it("should throw PermissionError for non-permitted dataset even if org has other permissions", async () => {
    const resolver = new PermissionsResolver(fixture.adminSupabase, []);
    await expect(
      resolver.resolveTables(
        {
          table1: Table.fromString(
            `${fixture.orgs.org_b.name}.connection.something`,
          ),
        },
        { orgName: fixture.orgs.org_a.name },
      ),
    ).rejects.toThrow(PermissionError);
  });
});
