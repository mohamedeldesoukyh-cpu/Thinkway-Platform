"use client";

import { format } from "date-fns";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertCurrencyAction,
  upsertExchangeRateAction,
  type FinanceActionState,
} from "@/features/finance/exchange-rates/actions";
import type { ExchangeRatesWorkspaceData } from "@/features/finance/exchange-rates/types";

type ExchangeRatesWorkspaceProps = {
  data: ExchangeRatesWorkspaceData;
};

export function ExchangeRatesWorkspace({ data }: ExchangeRatesWorkspaceProps) {
  const [tab, setTab] = useState("currencies");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="currencies">Currencies</TabsTrigger>
        <TabsTrigger value="rates">Exchange rates</TabsTrigger>
        <TabsTrigger value="history">FX history</TabsTrigger>
      </TabsList>

      <TabsContent value="currencies" className="space-y-4">
        <CurrencyForm currencies={data.currencies} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Currency master</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Decimals</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.currencies.map((currency) => (
                  <TableRow key={currency.code}>
                    <TableCell className="font-medium">{currency.code}</TableCell>
                    <TableCell>{currency.name}</TableCell>
                    <TableCell>{currency.symbol ?? "—"}</TableCell>
                    <TableCell>{currency.decimal_places}</TableCell>
                    <TableCell>
                      <Badge variant={currency.is_active ? "default" : "outline"}>
                        {currency.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="rates" className="space-y-4">
        <ExchangeRateForm currencies={data.currencies} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Effective-dated rates</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Effective from</TableHead>
                  <TableHead>Effective to</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>{rate.from_currency}</TableCell>
                    <TableCell>{rate.to_currency}</TableCell>
                    <TableCell className="text-right">
                      {rate.exchange_rate.toFixed(6)}
                    </TableCell>
                    <TableCell>{rate.effective_start_date}</TableCell>
                    <TableCell>{rate.effective_end_date ?? "Open-ended"}</TableCell>
                    <TableCell>{rate.source ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={rate.is_active ? "default" : "outline"}>
                        {rate.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FX audit & override history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.fx_history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No FX changes logged yet.</p>
            ) : (
              data.fx_history.map((entry) => (
                <div key={entry.id} className="rounded-2xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "PPp")}
                    </p>
                  </div>
                  <p className="text-muted-foreground">
                    {entry.changed_by_name ?? "System"}
                    {entry.recalculation_scope
                      ? ` · ${entry.recalculation_scope}`
                      : ""}
                  </p>
                  {entry.override_reason ? (
                    <p className="mt-1 text-amber-700 dark:text-amber-400">
                      {entry.override_reason}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function CurrencyForm({
  currencies,
}: {
  currencies: ExchangeRatesWorkspaceData["currencies"];
}) {
  const [state, action, pending] = useActionState(upsertCurrencyAction, {
    ok: false,
  } satisfies FinanceActionState);

  useEffect(() => {
    if (!state.message) return;
    toast[state.ok ? "success" : "error"](state.message);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add / update currency</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="grid gap-2">
            <Label htmlFor="currency_code">Code</Label>
            <Input id="currency_code" name="code" placeholder="USD" maxLength={3} required />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="currency_name">Name</Label>
            <Input id="currency_name" name="name" placeholder="US Dollar" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="currency_symbol">Symbol</Label>
            <Input id="currency_symbol" name="symbol" placeholder="$" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="decimal_places">Decimals</Label>
            <Input id="decimal_places" name="decimal_places" type="number" defaultValue={2} />
          </div>
          <div className="md:col-span-2 xl:col-span-5">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save currency"}
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          {currencies.length} currencies loaded dynamically for campaigns, billing, PO tracker, and VAT.
        </p>
      </CardContent>
    </Card>
  );
}

function ExchangeRateForm({
  currencies,
}: {
  currencies: ExchangeRatesWorkspaceData["currencies"];
}) {
  const [applyMode, setApplyMode] = useState<"future" | "override_historical">("future");
  const [state, action, pending] = useActionState(upsertExchangeRateAction, {
    ok: false,
  } satisfies FinanceActionState);

  useEffect(() => {
    if (!state.message) return;
    toast[state.ok ? "success" : "error"](state.message);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add exchange rate</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="apply_mode" value={applyMode} />
          <div className="grid gap-2">
            <Label>From</Label>
            <Select name="from_currency" defaultValue="USD">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.filter((c) => c.is_active).map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>To</Label>
            <Select name="to_currency" defaultValue="EGP">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {currencies.filter((c) => c.is_active).map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="exchange_rate">Rate</Label>
            <Input id="exchange_rate" name="exchange_rate" type="number" step="0.000001" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="effective_start_date">Effective from</Label>
            <Input id="effective_start_date" name="effective_start_date" type="date" required />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Apply mode</Label>
            <Select
              value={applyMode}
              onValueChange={(v) =>
                setApplyMode(v as "future" | "override_historical")
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="future">Apply starting from new date</SelectItem>
                <SelectItem value="override_historical">
                  Override all historical records
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {applyMode === "override_historical" ? (
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="override_reason">Override reason</Label>
              <Textarea id="override_reason" name="override_reason" rows={2} required />
            </div>
          ) : null}
          <div className="md:col-span-2 xl:col-span-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save rate"}
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Historical campaigns preserve FX snapshots. New effective-dated rates apply forward without recalculating frozen records.
        </p>
      </CardContent>
    </Card>
  );
}
