"use client";



import { useState, useTransition } from "react";

import { Loader2Icon } from "lucide-react";

import { toast } from "sonner";



import { Button } from "@/components/ui/button";

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogFooter,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import { Textarea } from "@/components/ui/textarea";

import {

  createShortlistAction,

  type ShortlistVisibility,

} from "@/features/discovery/actions";

import {

  DISCOVERY_DIALOG_BODY_CLASS,

  DISCOVERY_DIALOG_CANCEL_BUTTON_CLASS,

  DISCOVERY_DIALOG_CONTENT_CLASS,

  DISCOVERY_DIALOG_FIELD_LABEL_CLASS,

  DISCOVERY_DIALOG_FOOTER_ACTIONS_CLASS,

  DISCOVERY_DIALOG_FOOTER_CLASS,

  DISCOVERY_DIALOG_FORM_CLASS,

  DISCOVERY_DIALOG_FORM_PANEL_CLASS,

  DISCOVERY_DIALOG_HEADER_BAR_CLASS,

  DISCOVERY_DIALOG_HEADER_WRAP_CLASS,

  DISCOVERY_DIALOG_INPUT_CLASS,

  DISCOVERY_DIALOG_PRIMARY_BUTTON_CLASS,

  DISCOVERY_DIALOG_SELECT_CONTENT_CLASS,

  DISCOVERY_DIALOG_SELECT_ITEM_CLASS,

  DISCOVERY_DIALOG_TEXTAREA_CLASS,

  DISCOVERY_DIALOG_TITLE_CLASS,

} from "@/features/discovery/components/design-system";

import type { ShortlistCampaignOption } from "@/features/discovery/queries";

import { cn } from "@/lib/utils";



const NO_CAMPAIGN = "__none__";



export type CreatedShortlist = { id: string; name: string };



type Props = {

  open: boolean;

  onOpenChange: (open: boolean) => void;

  campaigns: ShortlistCampaignOption[];

  onCreated: (shortlist: CreatedShortlist) => void;

};



export function CreateListDialog({ open, onOpenChange, campaigns, onCreated }: Props) {

  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [campaignId, setCampaignId] = useState<string>(NO_CAMPAIGN);

  const [visibility, setVisibility] = useState<ShortlistVisibility>("private");

  const [isPending, startTransition] = useTransition();



  function handleOpenChange(next: boolean) {

    if (!next) {

      setName("");

      setDescription("");

      setCampaignId(NO_CAMPAIGN);

      setVisibility("private");

    }

    onOpenChange(next);

  }



  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault();

    const trimmed = name.trim();

    if (!trimmed) {

      toast.error("List name is required");

      return;

    }



    startTransition(async () => {

      try {

        const created = await createShortlistAction({

          name: trimmed,

          description: description.trim() || null,

          campaignHeaderId: campaignId === NO_CAMPAIGN ? null : campaignId,

          visibility,

        });

        toast.success(`List "${created.name}" created`);

        onCreated({ id: created.id, name: created.name });

        handleOpenChange(false);

      } catch (error) {

        toast.error(error instanceof Error ? error.message : "Failed to create list");

      }

    });

  }



  return (

    <Dialog open={open} onOpenChange={handleOpenChange}>

      <DialogContent className={DISCOVERY_DIALOG_CONTENT_CLASS}>

        <DialogHeader className={DISCOVERY_DIALOG_HEADER_WRAP_CLASS}>

          <div className={DISCOVERY_DIALOG_HEADER_BAR_CLASS}>

            <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b]">

              Discovery

            </p>

            <DialogTitle className={DISCOVERY_DIALOG_TITLE_CLASS}>Create list</DialogTitle>

            <DialogDescription className="text-xs leading-relaxed text-[#64748b]">

              Save creators into a reusable shortlist for this campaign or your team.

            </DialogDescription>

          </div>

        </DialogHeader>



        <form className={DISCOVERY_DIALOG_FORM_CLASS} onSubmit={handleSubmit}>

          <div className={DISCOVERY_DIALOG_BODY_CLASS}>

            <div className={DISCOVERY_DIALOG_FORM_PANEL_CLASS}>

              <div className="space-y-1.5">

                <Label htmlFor="create-list-name" className={DISCOVERY_DIALOG_FIELD_LABEL_CLASS}>

                  List name <span className="text-red-500">*</span>

                </Label>

                <Input

                  id="create-list-name"

                  value={name}

                  onChange={(event) => setName(event.target.value)}

                  placeholder="e.g. Q3 Beauty Shortlist"

                  className={DISCOVERY_DIALOG_INPUT_CLASS}

                  autoFocus

                  required

                  disabled={isPending}

                />

              </div>



              <div className="space-y-1.5">

                <Label

                  htmlFor="create-list-description"

                  className={DISCOVERY_DIALOG_FIELD_LABEL_CLASS}

                >

                  Description

                </Label>

                <Textarea

                  id="create-list-description"

                  value={description}

                  onChange={(event) => setDescription(event.target.value)}

                  placeholder="Optional notes about this list"

                  rows={2}

                  disabled={isPending}

                  className={DISCOVERY_DIALOG_TEXTAREA_CLASS}

                />

              </div>



              <div className="grid gap-3 sm:grid-cols-2">

                <div className="space-y-1.5">

                  <Label htmlFor="create-list-campaign" className={DISCOVERY_DIALOG_FIELD_LABEL_CLASS}>

                    Campaign

                  </Label>

                  <Select value={campaignId} onValueChange={setCampaignId} disabled={isPending}>

                    <SelectTrigger id="create-list-campaign" className={DISCOVERY_DIALOG_INPUT_CLASS}>

                      <SelectValue placeholder="No campaign" />

                    </SelectTrigger>

                    <SelectContent className={DISCOVERY_DIALOG_SELECT_CONTENT_CLASS}>

                      <SelectItem value={NO_CAMPAIGN} className={DISCOVERY_DIALOG_SELECT_ITEM_CLASS}>

                        No campaign

                      </SelectItem>

                      {campaigns.map((campaign) => (

                        <SelectItem

                          key={campaign.id}

                          value={campaign.id}

                          className={DISCOVERY_DIALOG_SELECT_ITEM_CLASS}

                        >

                          {campaign.document_number

                            ? `${campaign.document_number} · ${campaign.name}`

                            : campaign.name}

                        </SelectItem>

                      ))}

                    </SelectContent>

                  </Select>

                </div>



                <div className="space-y-1.5">

                  <Label

                    htmlFor="create-list-visibility"

                    className={DISCOVERY_DIALOG_FIELD_LABEL_CLASS}

                  >

                    Visibility

                  </Label>

                  <Select

                    value={visibility}

                    onValueChange={(value) => setVisibility(value as ShortlistVisibility)}

                    disabled={isPending}

                  >

                    <SelectTrigger id="create-list-visibility" className={DISCOVERY_DIALOG_INPUT_CLASS}>

                      <SelectValue />

                    </SelectTrigger>

                    <SelectContent className={DISCOVERY_DIALOG_SELECT_CONTENT_CLASS}>

                      <SelectItem value="private" className={DISCOVERY_DIALOG_SELECT_ITEM_CLASS}>

                        Private — only me

                      </SelectItem>

                      <SelectItem value="shared" className={DISCOVERY_DIALOG_SELECT_ITEM_CLASS}>

                        Shared — visible to team

                      </SelectItem>

                    </SelectContent>

                  </Select>

                </div>

              </div>

            </div>

          </div>



          <DialogFooter className={DISCOVERY_DIALOG_FOOTER_CLASS}>

            <div className={DISCOVERY_DIALOG_FOOTER_ACTIONS_CLASS}>

              <Button

                type="button"

                variant="outline"

                className={DISCOVERY_DIALOG_CANCEL_BUTTON_CLASS}

                onClick={() => handleOpenChange(false)}

                disabled={isPending}

              >

                Cancel

              </Button>

              <Button

                type="submit"

                className={DISCOVERY_DIALOG_PRIMARY_BUTTON_CLASS}

                disabled={isPending}

              >

                {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}

                Create list

              </Button>

            </div>

          </DialogFooter>

        </form>

      </DialogContent>

    </Dialog>

  );

}

