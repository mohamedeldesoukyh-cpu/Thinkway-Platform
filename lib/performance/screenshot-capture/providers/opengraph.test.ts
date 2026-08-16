import assert from "node:assert/strict";

import { extractOgImage } from "./opengraph";

const html = `
<html><head>
<meta property="og:image" content="https://scontent.xx.fbcdn.net/v/t15.5256-10/x.jpg?stp=dst-jpg&amp;_nc_cat=101&amp;oh=abc" />
</head></html>
`;

const url = extractOgImage(html);
assert.ok(url);
assert.equal(
  url,
  "https://scontent.xx.fbcdn.net/v/t15.5256-10/x.jpg?stp=dst-jpg&_nc_cat=101&oh=abc",
  "decodes Facebook og:image HTML entities"
);
assert.equal(url.includes("&amp;"), false);

console.log("opengraph extractOgImage tests passed");
