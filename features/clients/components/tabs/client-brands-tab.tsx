"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
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
import { createBrandAction } from "@/features/brands/actions";
import {
  AGENCY_OR_DIRECT_OPTIONS,
  CURRENCY_OPTIONS,
} from "@/features/clients/constants";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { ClientDetail } from "@/types/database";

type ClientBrandsTabProps = {
  client: ClientDetail;
  masterData: MasterDataOptions;
};

export function ClientBrandsTab({ client, masterData }: ClientBrandsTabProps) {
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [agencyOrDirect, setAgencyOrDirect] = useState("");
  const [vrRateId, setVrRateId] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [state, formAction, isPending] = useActionState(createBrandAction, {
    ok: false,
  });

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const subcategories = masterData.subcategories.filter(
    (s) => !categoryId || s.category_id === categoryId
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Brands</CardTitle>
          <p className="text-sm text-muted-foreground">
            Commercial brands under this legal entity. Campaigns link to brands.
          </p>
        </CardHeader>
        <CardContent>
          {client.brands.length === 0 ? (
            <p className="mb-4 text-sm text-muted-foreground">
              No brands yet for this legal entity.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>VR%</TableHead>
                  <TableHead>Currency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-mono text-xs">
                      {brand.document_number}
                    </TableCell>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell>{brand.category?.name ?? "—"}</TableCell>
                    <TableCell>
                      {brand.vr_rate ? `${brand.vr_rate.rate_percent}%` : "—"}
                    </TableCell>
                    <TableCell>{brand.currency_code}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add brand</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="client_id" value={client.id} />
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="subcategory_id" value={subcategoryId} />
            <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
            <input type="hidden" name="vr_rate_id" value={vrRateId} />
            <input type="hidden" name="currency_code" value={currency} />

            <div className="grid gap-2">
              <Label htmlFor="brand_name">Brand name</Label>
              <Input id="brand_name" name="name" required disabled={isPending} />
              <FieldError messages={state.fieldErrors?.name} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={categoryId}
                  onValueChange={(v) => {
                    setCategoryId(v);
                    setSubcategoryId("");
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {masterData.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Subcategory</Label>
                <Select
                  value={subcategoryId}
                  onValueChange={setSubcategoryId}
                  disabled={isPending || !categoryId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Agency / Direct</Label>
                <Select
                  value={agencyOrDirect}
                  onValueChange={setAgencyOrDirect}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENCY_OR_DIRECT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>VR%</Label>
                <Select value={vrRateId} onValueChange={setVrRateId} disabled={isPending}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {masterData.vrRates.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Adding…" : "Add brand"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
