export const PERIOD_TYPES = ["usage_right", "boosting"] as const;
export const EXTRA_RATE_TYPES = [
  {value:"usage_right",label:"Usage Rights (UR)"},
  {value:"boosting",label:"Boosting"},
  {value:"event_attendance",label:"Event Attendance"},
];
export function requiresPeriod(type:string){return PERIOD_TYPES.some(t=>t===type);}
export function validPeriod(value:unknown): value is number {return typeof value==="number"&&Number.isInteger(value)&&value>=1&&value<=120;}
export function periodLabel(months?:number|null,language="en"){return months?language==="ar"?`${months} شهر`:`${months} month${months===1?"":"s"}`:"";}
