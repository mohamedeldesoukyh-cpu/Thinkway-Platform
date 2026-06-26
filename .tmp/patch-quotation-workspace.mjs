import fs from "node:fs";

const path = "features/quotations/components/quotation-workspace.tsx";
let c = fs.readFileSync(path, "utf8");

if (!c.includes("totalAfEgp={totals.totalAfValueEgp}")) {
  c = c.replace(
    `            totalGpPct={totals.totalGpPct}
            gpTargetPct={detail.gp_target_pct}`,
    `            totalGpPct={totals.totalGpPct}
            totalAfEgp={totals.totalAfValueEgp}
            totalAgencyMarginEgp={totals.totalAgencyMarginEgp}
            gpTargetPct={detail.gp_target_pct}`
  );
}

if (!c.includes("AF%</TableHead>")) {
  c = c.replace(
    `                    <TableHead className="w-[88px] text-right">GP%</TableHead>
                    <TableHead className="w-[72px]">Status</TableHead>`,
    `                    <TableHead className="w-[88px] text-right">GP%</TableHead>
                    <TableHead className="w-[72px] text-right">AF%</TableHead>
                    <TableHead className="w-[100px] text-right">AF</TableHead>
                    <TableHead className="w-[110px] text-right">
                      {QUOTATION_CLIENT_LABELS.totalAgencyMargin}
                    </TableHead>
                    <TableHead className="w-[72px]">Status</TableHead>`
  );
}

if (!c.includes("const afPct = draft?.afPct")) {
  c = c.replace(
    `  const gpValue = draft?.gpValue ?? item.gp_value;
  const fxRate = draft?.fxRateToEgp ?? item.fx_rate_to_egp;`,
    `  const gpValue = draft?.gpValue ?? item.gp_value;
  const afPct = draft?.afPct ?? item.af_pct;
  const fxRate = draft?.fxRateToEgp ?? item.fx_rate_to_egp;`
  );
  c = c.replace(
    `        gpValue,
        fxRateToEgp: fxRate,
      }),
    [item.id, mode, cost, costCurrency, gpPct, revenue, gpValue, fxRate]`,
    `        gpValue,
        afPct,
        fxRateToEgp: fxRate,
      }),
    [item.id, mode, cost, costCurrency, gpPct, revenue, gpValue, afPct, fxRate]`
  );
}

if (!c.includes("af_pct?: number | null;")) {
  c = c.replace(
    `    gp_value?: number | null;
  }>(async (payload) => {`,
    `    gp_value?: number | null;
    af_pct?: number | null;
  }>(async (payload) => {`
  );
}

if (!c.includes("afPct: patch.afPct ?? afPct")) {
  c = c.replace(
    `        gpValue: patch.gpValue ?? gpValue,
        fxRateToEgp:`,
    `        gpValue: patch.gpValue ?? gpValue,
        afPct: patch.afPct ?? afPct,
        fxRateToEgp:`
  );
  c = c.replace(
    `        gp_value: next.gpValue,
      });`,
    `        gp_value: next.gpValue,
        af_pct: next.afPct,
      });`
  );
  c = c.replace(
    `      gpValue,
      fxRate,
      item.id,`,
    `      gpValue,
      afPct,
      fxRate,
      item.id,`
  );
}

const afCells = `      </TableCell>
      <TableCell className="text-right text-xs">
        <div className="flex items-center justify-end gap-0.5">
          <Input
            className="h-8 w-[56px] text-xs"
            inputMode="decimal"
            value={String(afPct || "")}
            onChange={(e) => triggerSave({ afPct: parseNum(e.target.value) })}
          />
          <span className="text-[10px] text-muted-foreground">%</span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {egp(computed.afValueEgp, 2)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs font-medium">
        {egp(computed.agencyMarginEgp, 2)}
      </TableCell>
      <TableCell>
        <SaveIndicator status={status} />`;

if (!c.includes("triggerSave({ afPct: parseNum")) {
  c = c.replace(
    `      </TableCell>
      <TableCell>
        <SaveIndicator status={status} />`,
    afCells
  );
}

fs.writeFileSync(path, c);
console.log("workspace patched");
