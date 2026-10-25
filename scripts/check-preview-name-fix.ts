import {writeFileSync} from 'node:fs';
import {buildRedesignedQuotationCreatorList} from '../features/quotations/export/quotation-list-redesign';
import {quotationListPdfOptions} from '../features/quotations/export/quotation-creator-list';
import {renderHtmlToPdf} from '../lib/io/vendor-io-pdf';
import type {QuotationDocument} from '../features/quotations/export/quotation-document';
async function main(){
 const row={option:'Option 1',serviceDescription:'1× IG Reel',deliverables:'1× IG Reel',clientCost:'100 EGP',totalInvestment:'100 EGP',af:'0 EGP',afPct:'0%',currency:'EGP',quotedPlatforms:['instagram'],tier:'Mid'};
 const names=['𝗘𝗟 𝗦𝗨𝗣𝗘𝗥 𝗠𝗔𝗠𝗔 — 𝗟𝗜𝗡𝗔𝗛 𝗔𝗧𝗧𝗜𝗔','𝙍𝘼𝙉𝘼 𝙉𝙊𝙐𝙈𝘼𝙉','MARC BAHOURY | مارك بحورى'];
 const doc={name:'Creator name rendering check',clientName:'Client',serial:'QT-test',template:'creator-list',issueDateLabel:'26 Oct 2026',hideCostAndFees:false,summary:{creatorCount:3,grandTotal:'300 EGP'},creatorGroups:names.map((creator,i)=>({creator,handle:'@creator'+i,itemIds:[String(i)],profileUrl:null,avatarUrl:null,categories:[],highestPlatformTier:'Mid',highestPlatformFollowers:0,rows:[row],platformMetrics:[]}))} as unknown as QuotationDocument;
 const html=buildRedesignedQuotationCreatorList({...doc,proposalOptions:[{recommended:true,document:doc}]} as QuotationDocument);
 const pdf=await renderHtmlToPdf(html,quotationListPdfOptions(doc));
 if(!pdf.ok)throw new Error(JSON.stringify(pdf));
 writeFileSync('C:/thinkway-platform/artifacts/preview-loading/fixed-names.pdf',pdf.buffer);
}
main();
