import type { AccountingSetup } from './setup-types';
export type SystemMapping={key:string;section:string;media_label:string;posting_use:string;account_type:string;normal_balance:string;kind:string;subledger:string|null;default_account:string;account:string|null;account_name:string|null;active:boolean;auxiliary_id:string|null;version:number;customized:boolean};
export function mappedAccount(setup:AccountingSetup,key:string,fallback:string){const row=setup.mappings?.find(m=>m.key===key);return row?(row.active?row.account??'':''):fallback;}
export function mappedAuxiliaries(setup:AccountingSetup,keys?:string[]){return Object.fromEntries((setup.mappings??[]).filter(m=>m.account&&m.auxiliary_id&&(!keys||keys.includes(m.key))).map(m=>[m.account!,m.auxiliary_id!]));}
