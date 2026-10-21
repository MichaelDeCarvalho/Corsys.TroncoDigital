// Disposable DEV QA metadata. Idempotency keys are test identifiers, never authentication credentials.
export const legacyFixtures = [
  {
    "org": "94b84958-4dd9-435d-9a4e-244220835d70",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_profile": {
        "status": "inactive",
        "full_name": "DEV HTTP LEGACY 20261019 A"
      },
      "p_member_id": "05c22aaa-188d-4f0d-91e7-7293f1072517",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A member update",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_updated_at": "1900-01-01T00:00:00Z"
    },
    "name": "save_member_profile",
    "actor": "a752dda8-4ef0-4c58-9d3b-b8fee14ec624",
    "label": "A",
    "replay": {
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_profile": {
        "status": "inactive",
        "full_name": "DEV HTTP LEGACY 20261019 A"
      },
      "p_member_id": "05c22aaa-188d-4f0d-91e7-7293f1072517",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A member update",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_updated_at": "2026-10-19T23:30:59.162407+00:00"
    },
    "result": "05c22aaa-188d-4f0d-91e7-7293f1072517"
  },
  {
    "org": "94b84958-4dd9-435d-9a4e-244220835d70",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_rule_id": "bfaf2510-8cd7-4e48-b336-c430c6f70a8b",
      "p_valid_from": "2026-12-01",
      "p_unit_amount": 2,
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A price",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_version_id": "22541722-ec0f-4e5f-8c70-d201bb6d0686"
    },
    "name": "schedule_tenant_monthly_price",
    "actor": "a752dda8-4ef0-4c58-9d3b-b8fee14ec624",
    "label": "A",
    "replay": {
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_rule_id": "bfaf2510-8cd7-4e48-b336-c430c6f70a8b",
      "p_valid_from": "2026-12-01",
      "p_unit_amount": 2,
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A price",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_version_id": "22541722-ec0f-4e5f-8c70-d201bb6d0686"
    },
    "result": "0c393e06-bc22-45b6-935e-e22bce1260a8"
  },
  {
    "org": "94b84958-4dd9-435d-9a4e-244220835d70",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_member_id": "05c22aaa-188d-4f0d-91e7-7293f1072517",
      "p_next_from": "2026-12-01",
      "p_next_type": null,
      "p_next_amount": null,
      "p_current_term_id": "e2ea9862-723b-46d0-b36d-29b3b30662ac",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A close term",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70"
    },
    "name": "transition_member_term",
    "actor": "a752dda8-4ef0-4c58-9d3b-b8fee14ec624",
    "label": "A",
    "replay": {
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_member_id": "05c22aaa-188d-4f0d-91e7-7293f1072517",
      "p_next_from": "2026-12-01",
      "p_next_type": null,
      "p_next_amount": null,
      "p_current_term_id": "e2ea9862-723b-46d0-b36d-29b3b30662ac",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A close term",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70"
    },
    "result": "e2ea9862-723b-46d0-b36d-29b3b30662ac"
  },
  {
    "org": "94b84958-4dd9-435d-9a4e-244220835d70",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_rule_id": "bfaf2510-8cd7-4e48-b336-c430c6f70a8b",
      "p_competence": "2027-01-01",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A stale generation",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_fingerprint": "0000000000000000000000000000000000000000000000000000000000000000"
    },
    "name": "generate_monthly_member_charges",
    "actor": "a752dda8-4ef0-4c58-9d3b-b8fee14ec624",
    "label": "A"
  },
  {
    "org": "94b84958-4dd9-435d-9a4e-244220835d70",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_cycle_id": "0752b1a0-2471-4f2e-a873-208c8001d253",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A budget conflict",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_revision": "00000000000000000000000000000000"
    },
    "name": "publish_tenant_budget",
    "actor": "a752dda8-4ef0-4c58-9d3b-b8fee14ec624",
    "label": "A"
  },
  {
    "org": "94b84958-4dd9-435d-9a4e-244220835d70",
    "args": {
      "p_kind": "account",
      "p_amount": 1,
      "p_period": "2026-10-01",
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_item_id": "1b435395-b192-4493-b16d-e8c669e4f1e3",
      "p_cycle_id": "0752b1a0-2471-4f2e-a873-208c8001d253",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A budget conflict",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_revision": "00000000000000000000000000000000"
    },
    "name": "set_tenant_budget_line",
    "actor": "a752dda8-4ef0-4c58-9d3b-b8fee14ec624",
    "label": "A"
  },
  {
    "org": "94b84958-4dd9-435d-9a4e-244220835d70",
    "args": {
      "p_kind": "category",
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_source_id": "df01dcfa-707c-4861-a9fb-719e7ec21f65",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A mapping",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_accounting_plan_id": "8808d810-380e-4037-8a30-aa1709f2e3da",
      "p_expected_account_id": null,
      "p_accounting_account_id": "11fa5369-9cf4-43b7-876f-d2af13cf4b59"
    },
    "name": "set_draft_accounting_mapping",
    "actor": "a752dda8-4ef0-4c58-9d3b-b8fee14ec624",
    "label": "A",
    "replay": {
      "p_kind": "category",
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_source_id": "df01dcfa-707c-4861-a9fb-719e7ec21f65",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A mapping",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_accounting_plan_id": "8808d810-380e-4037-8a30-aa1709f2e3da",
      "p_expected_account_id": null,
      "p_accounting_account_id": "11fa5369-9cf4-43b7-876f-d2af13cf4b59"
    },
    "result": "01cc4ebb-3c1f-45bf-b1b7-55baf75dc268"
  },
  {
    "org": "94b84958-4dd9-435d-9a4e-244220835d70",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_plan_id": "8808d810-380e-4037-8a30-aa1709f2e3da",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A publish stale",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_valid_to": "2034-12-31",
      "p_expected_valid_from": "2034-01-01"
    },
    "name": "publish_validated_accounting_plan",
    "actor": "a752dda8-4ef0-4c58-9d3b-b8fee14ec624",
    "label": "A"
  },
  {
    "org": "94b84958-4dd9-435d-9a4e-244220835d70",
    "args": {
      "p_amount": 2,
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_rule_id": "d71c9c51-335f-49ca-b221-5bed7f5d0412",
      "p_valid_from": "2026-12-01",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A institutional price",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_version_id": "9fe548f5-cc12-49ad-b52e-de09b76d47bf"
    },
    "name": "schedule_institutional_recurring_price",
    "actor": "a752dda8-4ef0-4c58-9d3b-b8fee14ec624",
    "label": "A",
    "replay": {
      "p_amount": 2,
      "p_reason": "DEV HTTP LEGACY 20261019 A",
      "p_rule_id": "d71c9c51-335f-49ca-b221-5bed7f5d0412",
      "p_valid_from": "2026-12-01",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 A institutional price",
      "p_organization_id": "94b84958-4dd9-435d-9a4e-244220835d70",
      "p_expected_version_id": "9fe548f5-cc12-49ad-b52e-de09b76d47bf"
    },
    "result": "cf7e6ae5-dc40-4eb5-a3ed-289f9693e90c"
  },
  {
    "org": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_profile": {
        "status": "inactive",
        "full_name": "DEV HTTP LEGACY 20261019 B"
      },
      "p_member_id": "fea114a9-392a-4e8f-af9d-89cf2a6e973c",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B member update",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_updated_at": "1900-01-01T00:00:00Z"
    },
    "name": "save_member_profile",
    "actor": "559ba052-c408-4418-b806-0c0c4b8e3603",
    "label": "B",
    "replay": {
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_profile": {
        "status": "inactive",
        "full_name": "DEV HTTP LEGACY 20261019 B"
      },
      "p_member_id": "fea114a9-392a-4e8f-af9d-89cf2a6e973c",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B member update",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_updated_at": "2026-10-19T23:30:59.162407+00:00"
    },
    "result": "fea114a9-392a-4e8f-af9d-89cf2a6e973c"
  },
  {
    "org": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_rule_id": "a2115731-1e34-4f96-8423-ba84479fa136",
      "p_valid_from": "2026-12-01",
      "p_unit_amount": 2,
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B price",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_version_id": "baacb084-74d2-4279-8a61-adad31084347"
    },
    "name": "schedule_tenant_monthly_price",
    "actor": "559ba052-c408-4418-b806-0c0c4b8e3603",
    "label": "B",
    "replay": {
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_rule_id": "a2115731-1e34-4f96-8423-ba84479fa136",
      "p_valid_from": "2026-12-01",
      "p_unit_amount": 2,
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B price",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_version_id": "baacb084-74d2-4279-8a61-adad31084347"
    },
    "result": "b75821b7-c1ef-4026-866b-00338a8f954e"
  },
  {
    "org": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_member_id": "fea114a9-392a-4e8f-af9d-89cf2a6e973c",
      "p_next_from": "2026-12-01",
      "p_next_type": null,
      "p_next_amount": null,
      "p_current_term_id": "607ab036-f940-4688-8e13-6ecc1359debd",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B close term",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4"
    },
    "name": "transition_member_term",
    "actor": "559ba052-c408-4418-b806-0c0c4b8e3603",
    "label": "B",
    "replay": {
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_member_id": "fea114a9-392a-4e8f-af9d-89cf2a6e973c",
      "p_next_from": "2026-12-01",
      "p_next_type": null,
      "p_next_amount": null,
      "p_current_term_id": "607ab036-f940-4688-8e13-6ecc1359debd",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B close term",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4"
    },
    "result": "607ab036-f940-4688-8e13-6ecc1359debd"
  },
  {
    "org": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_rule_id": "a2115731-1e34-4f96-8423-ba84479fa136",
      "p_competence": "2027-01-01",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B stale generation",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_fingerprint": "0000000000000000000000000000000000000000000000000000000000000000"
    },
    "name": "generate_monthly_member_charges",
    "actor": "559ba052-c408-4418-b806-0c0c4b8e3603",
    "label": "B"
  },
  {
    "org": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_cycle_id": "aca6e041-1661-4697-af5b-af6576319ab5",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B budget conflict",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_revision": "00000000000000000000000000000000"
    },
    "name": "publish_tenant_budget",
    "actor": "559ba052-c408-4418-b806-0c0c4b8e3603",
    "label": "B"
  },
  {
    "org": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
    "args": {
      "p_kind": "account",
      "p_amount": 1,
      "p_period": "2026-10-01",
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_item_id": "3dd14349-3938-474f-86b4-d3c9cafb2c25",
      "p_cycle_id": "aca6e041-1661-4697-af5b-af6576319ab5",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B budget conflict",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_revision": "00000000000000000000000000000000"
    },
    "name": "set_tenant_budget_line",
    "actor": "559ba052-c408-4418-b806-0c0c4b8e3603",
    "label": "B"
  },
  {
    "org": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
    "args": {
      "p_kind": "category",
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_source_id": "0bef3ce2-f77a-4e29-85f6-37e737630d1d",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B mapping",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_accounting_plan_id": "447b76b5-a75a-4546-8129-c10646704af1",
      "p_expected_account_id": null,
      "p_accounting_account_id": "ba80f75c-b893-4931-b39d-de73a9b6b80d"
    },
    "name": "set_draft_accounting_mapping",
    "actor": "559ba052-c408-4418-b806-0c0c4b8e3603",
    "label": "B",
    "replay": {
      "p_kind": "category",
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_source_id": "0bef3ce2-f77a-4e29-85f6-37e737630d1d",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B mapping",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_accounting_plan_id": "447b76b5-a75a-4546-8129-c10646704af1",
      "p_expected_account_id": null,
      "p_accounting_account_id": "ba80f75c-b893-4931-b39d-de73a9b6b80d"
    },
    "result": "b3fc0f63-50b7-4ded-91f9-813f4d049507"
  },
  {
    "org": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
    "args": {
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_plan_id": "447b76b5-a75a-4546-8129-c10646704af1",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B publish stale",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_valid_to": "2034-12-31",
      "p_expected_valid_from": "2034-01-01"
    },
    "name": "publish_validated_accounting_plan",
    "actor": "559ba052-c408-4418-b806-0c0c4b8e3603",
    "label": "B"
  },
  {
    "org": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
    "args": {
      "p_amount": 2,
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_rule_id": "7b3f7d61-9a7a-46cb-ad33-456d62128459",
      "p_valid_from": "2026-12-01",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B institutional price",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_version_id": "5254bb30-4dad-4a3d-9278-8679eacd057e"
    },
    "name": "schedule_institutional_recurring_price",
    "actor": "559ba052-c408-4418-b806-0c0c4b8e3603",
    "label": "B",
    "replay": {
      "p_amount": 2,
      "p_reason": "DEV HTTP LEGACY 20261019 B",
      "p_rule_id": "7b3f7d61-9a7a-46cb-ad33-456d62128459",
      "p_valid_from": "2026-12-01",
      "p_idempotency_key": "DEV HTTP LEGACY 20261019 B institutional price",
      "p_organization_id": "7a6aa771-524d-4d5a-9d38-7006175e1cb4",
      "p_expected_version_id": "5254bb30-4dad-4a3d-9278-8679eacd057e"
    },
    "result": "4aa79ab6-8603-40ed-8f76-d7b071fb44c4"
  }
]
