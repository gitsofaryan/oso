MODEL (
  name oso.int_crypto_ecosystems_developer_lifecycle_monthly_aggregated,
  description 'Developer lifecycle states for crypto ecosystem projects, powered by timeseries_metrics_by_project_v0 (unified events)',
  kind FULL,
  dialect trino,
  grain (bucket_month, project_id, label),
  audits (
    has_at_least_n_rows(threshold := 0),
  ),
  tags (
    'entity_category=project'
  )
);

SELECT
  t.sample_date AS bucket_month,
  t.project_id,
  p.project_name,
  p.display_name AS project_display_name,
  CASE m.metric_model
    WHEN 'first_time_contributor_unified'               THEN 'first time'
    WHEN 'active_full_time_contributor_unified'         THEN 'full time'
    WHEN 'new_full_time_contributor_unified'            THEN 'new full time'
    WHEN 'active_part_time_contributor_unified'         THEN 'part time'
    WHEN 'new_part_time_contributor_unified'            THEN 'new part time'
    WHEN 'part_time_to_full_time_contributor_unified'   THEN 'part time to full time'
    WHEN 'full_time_to_part_time_contributor_unified'   THEN 'full time to part time'
    WHEN 'reactivated_full_time_contributor_unified'    THEN 'dormant to full time'
    WHEN 'reactivated_part_time_contributor_unified'    THEN 'dormant to part time'
    WHEN 'churned_after_first_time_contributor_unified' THEN 'churned (after first time)'
    WHEN 'churned_after_part_time_contributor_unified'  THEN 'churned (after reaching part time)'
    WHEN 'churned_after_full_time_contributor_unified'  THEN 'churned (after reaching full time)'
  END AS label,
  t.amount AS developers_count
FROM oso.timeseries_metrics_by_project_v0 AS t
JOIN oso.metrics_v0 AS m ON t.metric_id = m.metric_id
JOIN oso.projects_v1 AS p ON t.project_id = p.project_id
WHERE
  p.project_namespace = 'eco'
  AND m.metric_event_source = 'GITHUB'
  AND m.metric_time_aggregation = 'monthly'
  AND m.metric_model IN (
    'first_time_contributor_unified',
    'new_part_time_contributor_unified',
    'new_full_time_contributor_unified',
    'active_part_time_contributor_unified',
    'active_full_time_contributor_unified',
    'part_time_to_full_time_contributor_unified',
    'full_time_to_part_time_contributor_unified',
    'reactivated_part_time_contributor_unified',
    'reactivated_full_time_contributor_unified',
    'churned_after_first_time_contributor_unified',
    'churned_after_part_time_contributor_unified',
    'churned_after_full_time_contributor_unified'
  )
