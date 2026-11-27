"use client";
import { MediaRecordNavigator } from "@/components/navigation/media-record-navigator";
export function CampaignSerialNavigation({currentId,activeTab}:{currentId?:string;activeTab?:string}) {
 return <MediaRecordNavigator kind="campaigns" currentId={currentId} activeTab={activeTab}/>;
}
