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
  // Fetch up to four independent ID chunks together, preserving result order.
  for(let start=0;start<unique.length;start+=400) {
    const chunks=[];
    for(let offset=start;offset<Math.min(start+400,unique.length);offset+=100)
      chunks.push(allPaymentRows(query(unique.slice(offset,offset+100))));
    for(const result of await Promise.all(chunks)) data.push(...result.data);
  }
  return {data,error:null};
}
