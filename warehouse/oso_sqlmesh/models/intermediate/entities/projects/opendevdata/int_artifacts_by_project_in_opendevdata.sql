MODEL (
  name oso.int_artifacts_by_project_in_opendevdata,
  description 'Many-to-many mapping of GitHub repositories to OpenDevData ecosystems',
  kind FULL,
  tags (
    'entity_category=artifact',
    'entity_category=project'
  ),
  audits (
    has_at_least_n_rows(threshold := 0),
    not_null(columns := (artifact_id, project_id))
  )
);

WITH parsed_artifacts AS (
  SELECT
    eco_repos.ecosystem_name,
    COALESCE(ossd_repos.artifact_source_id, gh_int.artifact_source_id)
      AS artifact_source_id,
    parsed_url.artifact_namespace,
    parsed_url.artifact_name,
    parsed_url.artifact_url,
    parsed_url.artifact_type
  FROM oso.int_repos_by_ecosystem_in_opendevdata AS eco_repos
  CROSS JOIN LATERAL @parse_github_repository_artifact(eco_repos.repo_link) AS parsed_url
  LEFT JOIN oso.int_artifacts__github AS gh_int
    ON gh_int.artifact_url = eco_repos.repo_link
  LEFT JOIN oso.int_repositories__ossd AS ossd_repos
    ON ossd_repos.artifact_namespace = parsed_url.artifact_namespace
    AND ossd_repos.artifact_name = parsed_url.artifact_name
),

eco_projects AS (
  SELECT
    'OPENDEVDATA' AS project_source,
    'eco' AS project_namespace,
    @to_entity_name(ecosystem_name) AS project_name,
    ecosystem_name AS project_display_name,
    'GITHUB' AS artifact_source,
    artifact_source_id,
    artifact_namespace,
    artifact_name,
    artifact_url,
    artifact_type
  FROM parsed_artifacts
  WHERE ecosystem_name IS NOT NULL
)

SELECT DISTINCT
  @oso_entity_id(project_source, project_namespace, project_name)
    AS project_id,
  project_source,
  project_namespace,
  project_name,
  project_display_name,
  @oso_entity_id(artifact_source, artifact_namespace, artifact_name)
    AS artifact_id,
  artifact_source,
  artifact_namespace,
  artifact_name,
  artifact_url,
  artifact_type,
  artifact_source_id
FROM eco_projects
