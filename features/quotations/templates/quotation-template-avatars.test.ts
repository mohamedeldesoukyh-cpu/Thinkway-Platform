import assert from "node:assert/strict";

import {
  quotationTemplateAvatarInitials,
  renderQuotationTemplateAvatarHtml,
  resolveQuotationTemplateAvatarSrc,
  resolveQuotationTemplatePublicationSrc,
} from "./quotation-template-avatars";

const SITE = "https://dev.thinkwaymedia.com";
const HD =
  "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/abc/instagram/face.jpg";
const DATA_URI = "data:image/jpeg;base64,/9j/4AAQ";
const BROKEN = "javascript:alert(1)";
const PROFILE_PIC =
  "https://scontent.cdninstagram.com/v/t51.2885-19/s150x150/avatar.jpg";
const POST =
  "https://scontent.cdninstagram.com/v/t51.82787-15/post.jpg";

{
  const src = resolveQuotationTemplateAvatarSrc(
    { avatarUrl: HD, avatarProxyUrl: null, profileUrl: "https://www.instagram.com/creator/" },
    SITE
  );
  assert.equal(src, HD, "valid high-quality stored avatar is used as-is");
}

{
  const src = resolveQuotationTemplateAvatarSrc(
    { avatarUrl: DATA_URI, avatarProxyUrl: "/api/creators/avatar?src=x", profileUrl: null },
    SITE
  );
  assert.equal(src, DATA_URI, "preview and PDF both use the embedded data URI");
  const pdfSrc = resolveQuotationTemplateAvatarSrc(
    { avatarUrl: DATA_URI, avatarProxyUrl: null, profileUrl: null },
    SITE
  );
  assert.equal(pdfSrc, src, "preview/PDF share the same image source");
}

{
  const src = resolveQuotationTemplateAvatarSrc(
    { avatarUrl: null, avatarProxyUrl: null, profileUrl: null },
    SITE
  );
  assert.equal(src, null, "missing avatar has no image src");
  const html = renderQuotationTemplateAvatarHtml(
    { creator: "Ada Lovelace", handle: "@ada", avatarUrl: null, avatarProxyUrl: null, profileUrl: null },
    SITE,
    "showcase"
  );
  assert.ok(html.includes("sc-avatar--initials"), "missing avatar uses initials fallback");
  assert.ok(html.includes("AL"));
  assert.equal(quotationTemplateAvatarInitials({ creator: "Ada Lovelace", handle: "@ada" }), "AL");
}

{
  const html = renderQuotationTemplateAvatarHtml(
    {
      creator: "Creator",
      handle: "@creator",
      avatarUrl: HD,
      avatarProxyUrl: null,
      profileUrl: "https://www.instagram.com/creator/",
    },
    SITE,
    "showcase"
  );
  assert.ok(html.includes(`src="${HD}"`));
  assert.ok(html.includes("sc-avatar--img"));
  assert.ok(html.includes("onerror="), "broken avatar img falls back to initials");
}

{
  const html = renderQuotationTemplateAvatarHtml(
    {
      creator: "Creator",
      handle: "@creator",
      avatarUrl: BROKEN,
      avatarProxyUrl: null,
      profileUrl: null,
    },
    SITE
  );
  assert.ok(
    html.includes("onerror=") || html.includes("sc-avatar--initials"),
    "invalid avatar source does not render a hanging broken image"
  );
}

{
  const src = resolveQuotationTemplatePublicationSrc(
    { imageUrl: POST, postUrl: "https://www.instagram.com/p/ABC/", caption: null, isVideo: false },
    SITE
  );
  assert.ok(src?.includes("/api/creators/publication-preview"), "social CDN publication media is proxied");
  assert.ok(src?.includes("postUrl="));
  assert.ok(src?.includes("src="));
}

{
  const src = resolveQuotationTemplatePublicationSrc(
    { imageUrl: DATA_URI, postUrl: "https://www.instagram.com/p/ABC/", caption: null, isVideo: false },
    SITE
  );
  assert.equal(src, DATA_URI, "preview/PDF publication embeds share the data URI");
}

{
  const src = resolveQuotationTemplatePublicationSrc(
    {
      imageUrl: PROFILE_PIC,
      postUrl: "https://www.instagram.com/p/ABC/",
      caption: null,
      isVideo: false,
    },
    SITE
  );
  assert.ok(
    src == null || src.includes("/api/creators/publication-preview"),
    "creator profile pics are not shown as publication images"
  );
}

{
  const src = resolveQuotationTemplatePublicationSrc(
    { imageUrl: "", postUrl: null, caption: null, isVideo: false },
    SITE
  );
  assert.equal(src, null, "publication without image has no src");
}

console.log("quotation-template-avatars.test.ts passed");
