export const RATE_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const RATE_UPLOAD_BUCKET = "rate-card-imports";
export const RATE_UPLOAD_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export function validRateUploadPath(path:string, userId:string) {
  return path.startsWith(userId+"/") && /^[0-9a-f-]{36}\/\d+-[0-9a-f-]{36}\.xlsx$/.test(path);
}
