import type {ImportRow} from "./model";
import {prepareRateUpload} from "./actions";
import {RATE_UPLOAD_MAX_BYTES,RATE_UPLOAD_MIME} from "./upload-limits";
export type UploadProgress={stage:"uploading"|"validating"|"matching"|"creating"|"importing"|"completed";processed:number;total:number};
export async function uploadForPreview(form:FormData,onProgress:(p:UploadProgress)=>void):Promise<ImportRow[]>{
  const file=form.get("file");if(!(file instanceof File)||file.size>RATE_UPLOAD_MAX_BYTES)throw new Error("file");
  const signed=await prepareRateUpload({name:file.name,size:file.size});
  form.set("uploadPath",signed.path);
  await new Promise<void>((resolve,reject)=>{
    const upload=new XMLHttpRequest();upload.open("PUT",signed.url);
    upload.setRequestHeader("Content-Type",RATE_UPLOAD_MIME);
    upload.upload.onprogress=e=>onProgress({stage:"uploading",processed:e.loaded,total:e.lengthComputable?e.total:0});
    upload.onload=()=>upload.status>=200&&upload.status<300?resolve():reject(new Error("file"));
    upload.onerror=()=>reject(new Error("error"));upload.ontimeout=()=>reject(new Error("error"));upload.timeout=300000;upload.send(file);
  });
  form.delete("file");
  onProgress({stage:"validating",processed:0,total:0});
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();let offset=0,pending="",rows:ImportRow[]|undefined;
    xhr.open("POST","/api/rate-cards/import-preview");
    xhr.upload.onload=()=>onProgress({stage:"validating",processed:0,total:0});
    const consume=()=>{pending+=xhr.responseText.slice(offset);offset=xhr.responseText.length;const lines=pending.split("\n");pending=lines.pop()??"";
      for(const line of lines){if(!line)continue;const data=JSON.parse(line);if(data.error){reject(new Error(data.error));return;}if(data.rows)rows=data.rows;else onProgress({stage:data.stage,processed:data.processed??0,total:data.total??0});}
    };
    xhr.onprogress=()=>{try{consume();}catch{reject(new Error("file"));}};
    xhr.onload=()=>{try{consume();if(xhr.status!==200||!rows)reject(new Error(xhr.status===403?"permission":"file"));else resolve(rows);}catch{reject(new Error("file"));}};
    xhr.onerror=()=>reject(new Error("error"));xhr.ontimeout=()=>reject(new Error("error"));xhr.timeout=300000;xhr.send(form);
  });
}
