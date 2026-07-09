// Minimal repro: formatToolOutput must not recurse (mirrors tool-output-formatter.ts)

function formatBuildCampaignOutput(output) {
  if (output == null) return "Campaign draft (no details available)";
  if (typeof output === "string") {
    const trimmed = output.trim();
    return trimmed || "Campaign draft (no details available)";
  }
  if (typeof output !== "object") return "Campaign draft (no details available)";
  const obj = output;
  const nested = obj.draft;
  const source = nested && typeof nested === "object" ? nested : obj;
  const name = source.name ?? source.title ?? obj.name ?? obj.title;
  if (name) return `**${name}**`;
  return "Campaign draft (details pending approval)";
}

function formatToolOutput(tool, output) {
  if (typeof output === "string" && output.trim()) return output.trim();
  if (tool === "buildCampaign") return formatBuildCampaignOutput(output);
  return tool === "buildCampaign" ? "" : "Unsupported tool";
}

try {
  const result = formatToolOutput("buildCampaign", { foo: "bar" });
  console.log("Result:", result);
  console.log("no error — recursion impossible by design");
} catch (e) {
  console.log("ERROR:", e.message);
}
