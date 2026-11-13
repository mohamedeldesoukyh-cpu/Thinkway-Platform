/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS validation script. */
// Isolated SQL integration tests; no ports, credentials or shared database access.
const {execFileSync}=require('node:child_process');const fs=require('node:fs');
const name='thinkway-signing-review-'+process.pid;
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
(async()=>{try{docker(['run','--detach','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=signing_review','postgres:16-alpine']);
for(let i=0;i<30;i++){try{docker(['exec',name,'pg_isready','-U','postgres','-d','signing_review']);break}catch{await new Promise(r=>setTimeout(r,300));}}
for(const file of ['scripts/tests/vendor-io-signing-local-schema.sql','supabase/migrations/20261111020000_vendor_io_electronic_signatures.sql','supabase/migrations/20261113010000_vendor_io_signed_evidence_protection.sql','scripts/test-vendor-io-signing.sql','scripts/tests/vendor-io-signing-protection.sql']){
try{const result=docker(['exec','-i',name,'psql','-U','postgres','-d','signing_review','-v','ON_ERROR_STOP=1'],fs.readFileSync(file));console.log('PASS '+file);if(file.includes('/tests/')||file.includes('test-vendor-io-signing.sql'))console.log(result.trim());}catch(e){process.stderr.write(e.stderr||'');throw e;}}
}finally{try{docker(['stop',name])}catch{}}})().catch(e=>{console.error(e.message);process.exitCode=1});
