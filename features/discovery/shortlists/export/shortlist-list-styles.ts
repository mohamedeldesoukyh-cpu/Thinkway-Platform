/** Shortlist-only density: seven readable profiles per slide, with natural text height. */
export const SHORTLIST_LIST_CSS = `
.cov .cov__client h1{font-size:52px;letter-spacing:-1px;line-height:1.1;max-width:28ch;overflow-wrap:anywhere}
.cov__recipient{font-size:22px;line-height:1.35;margin:22px 0 12px;max-width:52ch;overflow-wrap:anywhere}
.cov__count{margin-top:32px}.cov__client>img{max-width:300px;height:100px;object-fit:contain}
.ph{height:auto;min-height:64px}.ph__c{min-width:0;flex-wrap:wrap;gap:8px 12px}.ph__c .report-heading b{font-size:16px;line-height:1.35;white-space:normal;overflow-wrap:anywhere}.ph__c .report-heading{display:grid;gap:4px;min-width:0;flex:0 1 780px}.ph__c .report-client-name{font-size:12px;line-height:1.4;letter-spacing:.3px;text-transform:none;white-space:normal;overflow-wrap:anywhere}
.cards{grid-template-columns:repeat(7,minmax(0,1fr));align-items:stretch;min-height:0}
.creator-card{height:auto;min-height:508px}.creator-card>*{flex-shrink:0}.portrait{height:280px}
.creator-identity{min-height:56px;align-items:flex-start}.creator-label{min-width:0}.creator-label h2{max-height:none;white-space:normal;overflow-wrap:anywhere;line-height:17px}.creator-label p{white-space:normal;overflow-wrap:anywhere;line-height:14px}.creator-categories{margin-top:8px}
.ph .report-client-logo{max-width:110px;width:110px;height:42px;filter:none}
.cov__client>.cover-client-logo{flex-basis:240px;width:240px;max-width:240px;height:160px;filter:none}
`;
