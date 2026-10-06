import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join} from "node:path";

// Match the registered logo itself, so replacing a client's logo also removes
// its old presentation treatment. Other clients keep their own artwork.
const NBE_LOGO_SHA256="f04b92cf55abfb812fa520dc664efc008da5b285d7bb381a569ea793841f6263";
let nbeCoverArtwork:string|undefined;
export function rateCardCoverArtwork(clientLogo:string|null):string|null {
 const payload=clientLogo?.match(/^data:image\/png;base64,(.+)$/)?.[1];
 if(!payload||createHash("sha256").update(Buffer.from(payload,"base64")).digest("hex")!==NBE_LOGO_SHA256)return null;
 nbeCoverArtwork??=`data:image/png;base64,${readFileSync(join(process.cwd(),"public/report-assets/nbe-logo-3d-v1.png")).toString("base64")}`;
 return nbeCoverArtwork;
}
