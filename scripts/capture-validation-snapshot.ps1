# Capture TW-2026-0003 lifecycle snapshot after each UI step.
# Usage: .\scripts\capture-validation-snapshot.ps1 -Step "05-first-invoice"

param(
  [Parameter(Mandatory = $true)]
  [string]$Step
)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root "docs\validation-artifacts\snapshots"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = Join-Path $outDir "$Step-$stamp.txt"

$queries = @(
  @{ Name = "invoice_header"; Sql = "SELECT i.id, i.document_number, i.status, i.regeneration_status, i.is_operational_locked, i.subtotal, i.tax_amount, i.total, i.version_number FROM public.invoices i WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262' ORDER BY i.created_at" },
  @{ Name = "line_items_totals"; Sql = "SELECT i.document_number, count(ili.id) AS line_item_count, coalesce(sum(ili.revenue_before_vat),0) AS line_sum, i.subtotal, i.subtotal - coalesce(sum(ili.revenue_before_vat),0) AS delta FROM public.invoices i LEFT JOIN public.invoice_line_items ili ON ili.invoice_id = i.id WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262' GROUP BY i.id, i.document_number, i.subtotal" },
  @{ Name = "deliverables"; Sql = "SELECT ad.sort_order, ad.deliverable_type, ad.billing_status, ad.revenue_before_vat, ad.invoice_line_item_id, ad.locked_at IS NOT NULL AS is_locked FROM public.assignment_deliverables ad WHERE ad.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262' ORDER BY ad.sort_order" },
  @{ Name = "assignment_line"; Sql = "SELECT cl.document_number, cl.billing_status, cl.operational_status, cl.invoice_id FROM public.campaign_lines cl WHERE cl.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'" },
  @{ Name = "vendor_io"; Sql = "SELECT vio.document_number, vio.revision_number, vio.is_active, vio.superseded_at, vio.status FROM public.vendor_ios vio WHERE vio.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262' ORDER BY vio.created_at" },
  @{ Name = "invariant_failures"; Sql = "SELECT 'duplicate_deliverable' AS check_name, ili.invoice_id, ili.assignment_deliverable_id, count(*) FROM public.invoice_line_items ili JOIN public.invoices i ON i.id = ili.invoice_id WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262' AND ili.assignment_deliverable_id IS NOT NULL GROUP BY 1,2,3 HAVING count(*) > 1" }
)

"# Snapshot: $Step @ $stamp" | Out-File -FilePath $outFile -Encoding utf8
"# Campaign: TW-2026-0003 / LIFECYCLE-FINAL-VALIDATION-2026-06-04" | Out-File -FilePath $outFile -Append -Encoding utf8
"" | Out-File -FilePath $outFile -Append -Encoding utf8

Push-Location $root
try {
  foreach ($q in $queries) {
    "=== $($q.Name) ===" | Out-File -FilePath $outFile -Append -Encoding utf8
    $result = cmd /c "npx supabase db query --linked `"$($q.Sql)`" 2>&1"
    $result | Out-File -FilePath $outFile -Append -Encoding utf8
    "" | Out-File -FilePath $outFile -Append -Encoding utf8
    Start-Sleep -Seconds 2
  }
}
finally {
  Pop-Location
}

Write-Host "Snapshot saved: $outFile"
