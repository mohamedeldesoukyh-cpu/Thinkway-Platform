#!/usr/bin/env node
/**
 * Second-pass migration: add rows/columns/filterAccessors to OperationalTableSuiteProvider.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** @type {Record<string, { replacements: { find: string; replace: string }[]; addImports?: string[] }>} */
const FILE_UPDATES = {
  "features/groups/components/tabs/group-brands-tab.tsx": {
    addImports: [
      'import { GROUP_BRANDS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupBrands}
        columns={columnMetas}
      >`,
        replace: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupBrands}
        columns={columns}
        rows={filteredBrands}
        filterAccessors={GROUP_BRANDS_FILTER_ACCESSORS}
      >`,
      },
    ],
  },
  "features/groups/components/tabs/group-legal-entities-tab.tsx": {
    addImports: [
      'import { GROUP_LEGAL_ENTITIES_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupLegalEntities}
        columns={columnMetas}
      >`,
        replace: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupLegalEntities}
        columns={columns}
        rows={workspace.legal_entities}
        filterAccessors={GROUP_LEGAL_ENTITIES_FILTER_ACCESSORS}
      >`,
      },
    ],
  },
  "features/groups/components/tabs/group-activity-tab.tsx": {
    addImports: [
      'import { GROUP_RECENT_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupRecentCampaigns}
        columns={GROUP_RECENT_CAMPAIGNS_COLUMN_METAS}
      >`,
        replace: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupRecentCampaigns}
        columns={GROUP_RECENT_CAMPAIGNS_COLUMNS}
        rows={workspace.recent_campaigns}
        filterAccessors={GROUP_RECENT_CAMPAIGNS_FILTER_ACCESSORS}
      >`,
      },
    ],
  },
  "features/groups/components/tabs/group-documents-tab.tsx": {
    addImports: [
      'import { GROUP_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupDocuments}
        columns={columnMetas}
      >`,
        replace: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.groupDocuments}
        columns={columns}
        rows={workspace.documents}
        filterAccessors={GROUP_DOCUMENTS_FILTER_ACCESSORS}
      >`,
      },
    ],
  },
  "features/clients/components/tabs/client-brands-tab.tsx": {
    addImports: [
      'import { CLIENT_BRANDS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.clientBrands}
          columns={columnMetas}
        >`,
        replace: `        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.clientBrands}
          columns={columns}
          rows={client.brands}
          filterAccessors={CLIENT_BRANDS_FILTER_ACCESSORS}
        >`,
      },
    ],
  },
  "features/clients/components/tabs/client-documents-tab.tsx": {
    addImports: [
      'import { CLIENT_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.clientDocuments}
        columns={columnMetas}
      >`,
        replace: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.clientDocuments}
        columns={columns}
        rows={client.documents}
        filterAccessors={CLIENT_DOCUMENTS_FILTER_ACCESSORS}
      >`,
      },
    ],
  },
  "features/vendors/components/tabs/vendor-assignments-tab.tsx": {
    addImports: [
      'import { VENDOR_ASSIGNMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorAssignments}
        columns={columnMetas}
      >`,
        replace: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorAssignments}
        columns={columns}
        rows={workspace.assignments}
        filterAccessors={VENDOR_ASSIGNMENTS_FILTER_ACCESSORS}
      >`,
      },
    ],
  },
  "features/vendors/components/tabs/vendor-documents-tab.tsx": {
    addImports: [
      'import { VENDOR_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorDocuments}
        columns={columnMetas}
      >`,
        replace: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorDocuments}
        columns={columns}
        rows={vendor.documents}
        filterAccessors={VENDOR_DOCUMENTS_FILTER_ACCESSORS}
      >`,
      },
    ],
  },
  "features/vendors/components/tabs/vendor-billing-tab.tsx": {
    addImports: [
      'import { VENDOR_PAYOUTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorBilling}
        columns={VENDOR_BILLING_COLUMN_METAS}
      >`,
        replace: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorBilling}
        columns={VENDOR_BILLING_COLUMNS}
        rows={workspace.payouts}
        filterAccessors={VENDOR_PAYOUTS_FILTER_ACCESSORS}
      >`,
      },
    ],
  },
  "features/vendors/components/tabs/vendor-activity-tab.tsx": {
    addImports: [
      'import { VENDOR_DELIVERABLES_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorDeliverablesActivity}
        columns={VENDOR_DELIVERABLES_COLUMN_METAS}
      >`,
        replace: `      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.vendorDeliverablesActivity}
        columns={VENDOR_DELIVERABLES_COLUMNS}
        rows={recentDeliverables}
        filterAccessors={VENDOR_DELIVERABLES_FILTER_ACCESSORS}
      >`,
      },
    ],
  },
  "app/(dashboard)/settings/users/page.tsx": {
    addImports: [
      'import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";',
      'import { USERS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.settingsUsers}
          columns={USERS_TABLE_COLUMN_METAS}
        >`,
        replace: `        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.settingsUsers}
          columns={operationalColumnsFromMetas(USERS_TABLE_COLUMN_METAS, USERS_TABLE_FILTER_ACCESSORS)}
          rows={users}
          filterAccessors={USERS_TABLE_FILTER_ACCESSORS}
        >`,
      },
    ],
  },
  "app/(dashboard)/settings/roles/page.tsx": {
    addImports: [
      'import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";',
      'import { ROLES_TABLE_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
    ],
    replacements: [
      {
        find: `        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.settingsRoles}
          columns={ROLES_TABLE_COLUMN_METAS}
        >`,
        replace: `        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.settingsRoles}
          columns={operationalColumnsFromMetas(ROLES_TABLE_COLUMN_METAS, ROLES_TABLE_FILTER_ACCESSORS)}
          rows={roles}
          filterAccessors={ROLES_TABLE_FILTER_ACCESSORS}
        >`,
      },
    ],
  },
  "features/finance/adjustments/components/adjustment-register-section.tsx": {
    addImports: [
      'import { ADJUSTMENT_REGISTER_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";',
      'import { operationalColumnsFromMetas } from "@/lib/tables/operational-filter-columns";',
    ],
    replacements: [
      {
        find: `    <OperationalTableSuiteProvider
      tableId={financeAdjustmentRegisterTableId(moduleKey)}
      columns={ADJUSTMENT_REGISTER_COLUMN_METAS}
    >`,
        replace: `    <OperationalTableSuiteProvider
      tableId={financeAdjustmentRegisterTableId(moduleKey)}
      columns={operationalColumnsFromMetas(ADJUSTMENT_REGISTER_COLUMN_METAS, ADJUSTMENT_REGISTER_FILTER_ACCESSORS)}
      rows={rows}
      filterAccessors={ADJUSTMENT_REGISTER_FILTER_ACCESSORS}
    >`,
      },
    ],
  },
};

function addImports(content, imports) {
  let result = content;
  for (const imp of imports) {
    if (result.includes(imp)) continue;
    const lastImport = [...result.matchAll(/^import .+$/gm)].pop();
    if (lastImport) {
      const insertAt = lastImport.index + lastImport[0].length;
      result = result.slice(0, insertAt) + "\n" + imp + result.slice(insertAt);
    }
  }
  return result;
}

let changed = 0;
for (const [rel, config] of Object.entries(FILE_UPDATES)) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.warn("missing:", rel);
    continue;
  }
  let content = fs.readFileSync(full, "utf8");
  const original = content;
  if (config.addImports) {
    content = addImports(content, config.addImports);
  }
  for (const { find, replace } of config.replacements) {
    if (!content.includes(find)) {
      console.warn("pattern not found in", rel);
      continue;
    }
    content = content.replace(find, replace);
  }
  if (content !== original) {
    fs.writeFileSync(full, content);
    changed++;
    console.log("updated:", rel);
  }
}

console.log(`\n${changed} files updated with provider props`);
