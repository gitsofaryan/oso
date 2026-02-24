MODEL (
  name oso.int_repos_by_ecosystem_in_opendevdata,
  description 'Maps OpenDevData ecosystems to GitHub repository links, filtering out categories and internal names',
  kind FULL,
  tags (
    'entity_category=artifact',
    'entity_category=project'
  ),
  audits (
    has_at_least_n_rows(threshold := 0)
  )
);

SELECT
  e.name AS ecosystem_name,
  r.link AS repo_link,
  er.distance
FROM oso.stg_opendevdata__ecosystems_repos_recursive AS er
JOIN oso.stg_opendevdata__ecosystems AS e
  ON e.id = er.ecosystem_id
JOIN oso.stg_opendevdata__repos AS r
  ON r.id = er.repo_id
WHERE e.is_category = 0
  AND e.name NOT LIKE '[%'
  AND e.name NOT LIKE '\_%'
  AND r.link LIKE 'https://github.com%'
