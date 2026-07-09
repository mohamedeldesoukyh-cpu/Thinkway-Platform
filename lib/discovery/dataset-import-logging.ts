export type DatasetImportFailureLog = {
  stage: string;
  username: string;
  datasetId: string | null;
  searchId: string;
  apifyRunId: string | null;
  message: string;
};

export function logDatasetImportFailure(log: DatasetImportFailureLog): void {
  console.error("[dataset-import]", log);
}
