import fs from "node:fs";

const lines = fs.readFileSync("app/globals.css", "utf8").split(/\r?\n/);

// Campaign already extracted; rebuild globals from current file if still monolithic
const hasCampaign = lines.some((l) => l.includes("thinkway-campaign_2.html"));
if (!hasCampaign) {
  console.log("globals.css already split — aborting rewrite");
  process.exit(0);
}

const head = lines.slice(0, 335);
const tail = lines.slice(4364);

const chrome = `/* Shared logo + page loader (used outside /login) */
.login-v2-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.login-v2-logo-mark {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: var(--login-navy);
  flex-shrink: 0;
}
.login-v2-logo-mark::before {
  content: "";
  position: absolute;
  top: 8px;
  left: 8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #fff;
}
.login-v2-logo-mark::after {
  content: "";
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: var(--login-blue);
}
.login-v2-logo-text {
  font-size: 16px;
  font-weight: 800;
  color: var(--login-navy);
  letter-spacing: -0.4px;
}
.login-v2-logo-text span {
  color: var(--login-blue);
}
.thinkway-logo-compact .login-v2-logo-mark {
  width: 28px;
  height: 28px;
  border-radius: 7px;
}
.thinkway-logo-compact .login-v2-logo-mark::before {
  top: 6px;
  left: 6px;
  width: 8px;
  height: 8px;
}
.thinkway-logo-compact .login-v2-logo-mark::after {
  right: 4px;
  bottom: 4px;
  width: 11px;
  height: 11px;
}
.thinkway-page-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
}
.thinkway-page-loader-logo .login-v2-logo-mark {
  animation: thinkway-loader-pulse 1.15s ease-in-out infinite;
}
@keyframes thinkway-loader-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.07);
    opacity: 0.88;
  }
}
`;

fs.mkdirSync("app/styles", { recursive: true });
fs.writeFileSync("app/styles/chrome-logo.css", chrome);

let headText = head.join("\n");
headText = headText.replace(
  '@import "./thinkway-platform-v6.css" layer(components);\n',
  ""
);
headText = headText.replace(
  '@import "./thinkway-dropdown.css" layer(components);',
  '@import "./thinkway-dropdown.css" layer(components);\n@import "./styles/chrome-logo.css" layer(components);'
);

const out = `${headText}\n\n${tail.join("\n")}`;
fs.writeFileSync("app/globals.css", out.endsWith("\n") ? out : `${out}\n`);

console.log({
  globalsKb: (fs.statSync("app/globals.css").size / 1024).toFixed(1),
  campaignKb: (fs.statSync("app/styles/campaign-workspace.css").size / 1024).toFixed(1),
  loginKb: (fs.statSync("app/styles/login-v2.css").size / 1024).toFixed(1),
  chromeKb: (fs.statSync("app/styles/chrome-logo.css").size / 1024).toFixed(1),
  platformV6Kb: (fs.statSync("app/thinkway-platform-v6.css").size / 1024).toFixed(1),
});
