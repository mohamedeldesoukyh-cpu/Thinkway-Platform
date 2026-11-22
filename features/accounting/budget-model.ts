import {cents,decimal} from './journal-model';
export function allocateBudget(amount:string,count=12){if(!Number.isInteger(count)||count<1||count>12)throw new Error('Invalid period count');const total=cents(amount),n=BigInt(count),base=total/n,remainder=total%n;return Array.from({length:count},(_,i)=>decimal(base+(BigInt(i)<(remainder<BigInt(0)?-remainder:remainder)?(remainder<BigInt(0)?-BigInt(1):BigInt(1)):BigInt(0))));}
export function budgetVariance(type:string,budget:string,actual:string){return decimal(type==='Revenue'?cents(actual)-cents(budget):cents(budget)-cents(actual));}
