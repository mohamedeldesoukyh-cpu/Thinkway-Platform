export async function measureRedisPing(
  redis: {connect:()=>Promise<unknown>;ping:()=>Promise<string>},
  now:()=>number=()=>performance.now(),
){
  const start=now();
  await redis.connect();
  const connected=now();
  const pong=await redis.ping();
  return {pong,connectionLatencyMs:Math.round(connected-start),latencyMs:Math.round(now()-connected)};
}
