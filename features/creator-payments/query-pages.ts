type PageQuery<T> = { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }> };

/** PostgREST caps each response; payment balances must never use truncated entries. */
export async function allPaymentRows<T>(query: PageQuery<T>) {
  const data: T[] = [];
  for (let start=0;;start+=500) {
    const page=await query.range(start,start+499);
    if(page.error) throw new Error(page.error.message);
    data.push(...(page.data??[]));
    if((page.data?.length??0)<500) return {data,error:null};
  }
}

export async function paymentRowsByIds<T>(ids: string[], query: (chunk: string[])=>PageQuery<T>) {
  const unique=[...new Set(ids)];const data:T[]=[];
  // Bound URL length as well as response size.
  for(let start=0;start<unique.length;start+=100) data.push(...(await allPaymentRows(query(unique.slice(start,start+100)))).data);
  return {data,error:null};
}
