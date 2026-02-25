package trino_test

import data.trino

test_admin_users_have_full_access if {
	trino.allow with input as {"context": {
		"identity": {"user": "admin"},
		"softwareStack": {"trinoVersion": "434"},
	}}
	trino.allow with input as {"context": {
		"identity": {"user": "sqlmesh"},
		"softwareStack": {"trinoVersion": "434"},
	}}
	trino.allow with input as {"context": {
		"identity": {"user": "carl"},
		"softwareStack": {"trinoVersion": "434"},
	}}
}

test_read_only_user_can_execute_query if {
	trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {"operation": "ExecuteQuery"},
	}
}

test_read_only_user_can_access_public_catalog if {
	trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "iceberg",
				"schemaName": "example_schema",
				"tableName": "example_table",
			}},
		},
	}
	trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "AccessCatalog",
			"resource": {"catalog": {"name": "iceberg"}},
		},
	}
}

test_users_can_access_their_org_catalogs if {
	trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "orgname__catalog",
				"schemaName": "example_schema",
				"tableName": "example_table",
			}},
		},
	}
	trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "org_orgid_catalog",
				"schemaName": "example_schema",
				"tableName": "example_table",
			}},
		},
	}
	trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "AccessCatalog",
			"resource": {"catalog": {"name": "orgname__catalog"}},
		},
	}
	trino.allow with input as {
		"context": {
			"identity": {"user": "rw-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "orgname__catalog",
				"schemaName": "example_schema",
				"tableName": "example_table",
			}},
		},
	}
}

test_user_denied_access_to_other_org_catalog if {
	not trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "example_catalog",
				"schemaName": "example_schema",
				"tableName": "example_table",
			}},
		},
	}
}

test_anonymous_user_denied_access if {
	not trino.allow with input as {"context": {
		"identity": {"user": ""},
		"softwareStack": {"trinoVersion": "434"},
	}}
}

test_user_denied_access_to_wrong_catalog if {
	not trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "another-catalog",
				"schemaName": "some-id",
				"tableName": "example_table",
			}},
		},
	}
}

test_users_can_read_from_user_shared_catalog if {
	trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "user_shared",
				"schemaName": "org_orgid_datasetid",
				"tableName": "random_table",
				"columns": ["col1", "col2"],
			}},
		},
	}
	trino.allow with input as {
		"context": {
			"identity": {"user": "rw-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "user_shared",
				"schemaName": "org_orgid_datasetid",
				"tableName": "random_table",
			}},
		},
	}
}

test_rw_user_can_write_to_user_shared_catalog if {
	trino.allow with input as {
		"context": {
			"identity": {"user": "rw-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "CreateTable",
			"resource": {"table": {
				"catalogName": "user_shared",
				"schemaName": "org_orgid_datasetid",
				"tableName": "new_table",
			}},
		},
	}
	trino.allow with input as {
		"action": {
			"operation": "AccessCatalog",
			"resource": {"catalog": {"name": "user_shared"}},
		},
		"context": {"identity": {
			"groups": [],
			"user": "rw-orgname-orgid",
		}},
	}
	trino.allow with input as {
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "user_shared",
				"columns": ["table_schema", "table_catalog", "table_name", "table_type"],
				"schemaName": "information_schema", "tableName": "tables",
			}},
		},
		"context": {"identity": {
			"groups": [],
			"user": "rw-orgname-orgid",
		}},
	}
}

test_rw_user_denied_write_to_wrong_catalog if {
	not trino.allow with input as {
		"context": {
			"identity": {"user": "rw-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "CreateTable",
			"resource": {"table": {
				"catalogName": "orgname__catalog",
				"schemaName": "org_orgid_datasetid",
				"tableName": "new_table",
			}},
		},
	}
	not trino.allow with input as {
		"context": {
			"identity": {"user": "rw-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "CreateTable",
			"resource": {"table": {
				"catalogName": "iceberg",
				"schemaName": "some_schema",
				"tableName": "new_table",
			}},
		},
	}
}

test_rw_user_denied_write_to_wrong_schema if {
	not trino.allow with input as {
		"context": {
			"identity": {"user": "rw-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "CreateTable",
			"resource": {"table": {
				"catalogName": "user_shared",
				"schemaName": "org_different_orgid_datasetid",
				"tableName": "new_table",
			}},
		},
	}
	not trino.allow with input as {
		"context": {
			"identity": {"user": "rw-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "CreateTable",
			"resource": {"table": {
				"catalogName": "user_shared",
				"schemaName": "random_schema",
				"tableName": "new_table",
			}},
		},
	}	
	not trino.allow with input as {
		"context": {
			"identity": {"user": "rw-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "CreateTable",
			"resource": {"table": {
				"catalogName": "user_shared",
				"schemaName": "random_schema",
				"tableName": "new_table",
			}},
		},
	}
}

test_ro_user_denied_write_operations if {
	not trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "CreateTable",
			"resource": {"table": {
				"catalogName": "user_shared",
				"schemaName": "org_orgid_datasetid",
				"tableName": "new_table",
			}},
		},
	}
	not trino.allow with input as {
		"context": {
			"identity": {"user": "ro-orgname-orgid"},
			"softwareStack": {"trinoVersion": "434"},
		},
		"action": {
			"operation": "DropTable",
			"resource": {"table": {
				"catalogName": "user_shared",
				"schemaName": "org_orgid_datasetid",
				"tableName": "old_table",
			}},
		},
	}
}

# --- Cross-org shared schema tests ---

mock_shared_schemas := {"suborgid": {"publisher__catalog": ["org_puborgid__datasetid"]}}

test_shared_schema_read_access if {
	trino.allow with input as {
		"context": {"identity": {"user": "ro-suborg-suborgid"}},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "publisher__catalog",
				"schemaName": "org_puborgid__datasetid",
				"tableName": "some_table",
			}},
		},
	} with data.shared_schemas as mock_shared_schemas
}

test_shared_schema_info_schema_access if {
	trino.allow with input as {
		"context": {"identity": {"user": "ro-suborg-suborgid"}},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "publisher__catalog",
				"schemaName": "information_schema",
				"tableName": "tables",
			}},
		},
	} with data.shared_schemas as mock_shared_schemas
}

test_shared_schema_denied_wrong_schema if {
	not trino.allow with input as {
		"context": {"identity": {"user": "ro-suborg-suborgid"}},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "publisher__catalog",
				"schemaName": "org_puborgid__other_dataset",
				"tableName": "some_table",
			}},
		},
	} with data.shared_schemas as mock_shared_schemas
}

test_shared_schema_denied_write if {
	not trino.allow with input as {
		"context": {"identity": {"user": "rw-suborg-suborgid"}},
		"action": {
			"operation": "CreateTable",
			"resource": {"table": {
				"catalogName": "publisher__catalog",
				"schemaName": "org_puborgid__datasetid",
				"tableName": "new_table",
			}},
		},
	} with data.shared_schemas as mock_shared_schemas
}

test_shared_schema_denied_wrong_org if {
	not trino.allow with input as {
		"context": {"identity": {"user": "ro-otherorgnm-otherorgid"}},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "publisher__catalog",
				"schemaName": "org_puborgid__datasetid",
				"tableName": "some_table",
			}},
		},
	} with data.shared_schemas as mock_shared_schemas
}

test_empty_shared_schemas_backward_compat if {
	# Existing org catalog access still works with empty shared_schemas
	trino.allow with input as {
		"context": {"identity": {"user": "ro-orgname-orgid"}},
		"action": {
			"operation": "SelectFromColumns",
			"resource": {"table": {
				"catalogName": "orgname__catalog",
				"schemaName": "some_schema",
				"tableName": "some_table",
			}},
		},
	} with data.shared_schemas as {}
}
