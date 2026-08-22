import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ENTITY_LOGOS_BUCKET,
  entityLogoExtension,
  parseEntityLogoKind,
  pickIdentityLogo,
  storagePathFromPublicLogoUrl,
} from "./identity-logo";

test("identity logo prefers group over client", () => {
  const picked = pickIdentityLogo({
    groupLogoUrl: "https://cdn.example/group.png",
    clientLogoUrl: "https://cdn.example/client.png",
    groupName: "HoldCo",
    clientName: "Legal Entity",
  });
  assert.equal(picked?.source, "group");
  assert.equal(picked?.url, "https://cdn.example/group.png");
  assert.equal(picked?.alt, "HoldCo");
});

test("identity logo falls back to client when group has no logo", () => {
  const picked = pickIdentityLogo({
    groupLogoUrl: "  ",
    clientLogoUrl: "https://cdn.example/client.png",
    clientName: "Legal Entity",
  });
  assert.equal(picked?.source, "client");
  assert.equal(picked?.url, "https://cdn.example/client.png");
  assert.equal(picked?.alt, "Legal Entity");
});

test("identity logo is omitted when neither group nor client has a logo", () => {
  assert.equal(pickIdentityLogo({ brandLogoUrl: "https://cdn.example/brand.png" } as never), null);
});

test("entity logo helpers accept image types and parse storage paths", () => {
  assert.equal(parseEntityLogoKind("group"), "group");
  assert.equal(parseEntityLogoKind("vendor"), null);
  assert.equal(entityLogoExtension("image/png"), "png");
  assert.equal(entityLogoExtension("image/svg+xml"), null);
  assert.equal(
    storagePathFromPublicLogoUrl(
      `https://hsxrewjcbvmbkqdlzjhs.supabase.co/storage/v1/object/public/${ENTITY_LOGOS_BUCKET}/group/abc/file.png`
    ),
    "group/abc/file.png"
  );
});
