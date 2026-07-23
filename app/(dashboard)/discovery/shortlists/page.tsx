import Link from "next/link";



import { Button } from "@/components/ui/button";

import {

  DiscoveryEmptyState,

} from "@/features/discovery/components/design-system";

import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";

import { ShortlistsList } from "@/features/discovery/shortlists/components/shortlists-list";

import {

  getDiscoveryShortlistsV2,

  getShortlistBrandOptions,

} from "@/features/discovery/shortlists/queries";

import type {

  ShortlistBrandOption,

  ShortlistListRow,

} from "@/features/discovery/shortlists/types";



export default async function DiscoveryShortlistsPage() {

  let shortlists: ShortlistListRow[] = [];

  let brands: ShortlistBrandOption[] = [];

  let errorMessage: string | null = null;



  try {

    [shortlists, brands] = await Promise.all([

      getDiscoveryShortlistsV2(),

      getShortlistBrandOptions(),

    ]);

  } catch (error) {

    errorMessage = error instanceof Error ? error.message : "Failed to load shortlists.";

  }



  return (

    <DiscoveryPageShell page="shortlists" variant="flush" showHeader={false}>

      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">

        {errorMessage ? (

          <div className="mx-8 mt-6 rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">

            {errorMessage}

          </div>

        ) : shortlists.length === 0 ? (

          <div className="mx-8 mt-6 rounded-[var(--radius-lg)] border border-dashed border-border px-6 py-12">

            <DiscoveryEmptyState

              title="No shortlists yet"

              description="Create a shortlist, then add creators from Search or Compare."

            >

              <Button asChild variant="secondary">

                <Link href="/discovery/search">Open Creator Search</Link>

              </Button>

            </DiscoveryEmptyState>

          </div>

        ) : (

          <ShortlistsList shortlists={shortlists} brands={brands} />

        )}

      </div>

    </DiscoveryPageShell>

  );

}

