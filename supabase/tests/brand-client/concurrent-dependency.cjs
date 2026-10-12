const {spawn,spawnSync}=require('node:child_process');
const exe='C:/Program Files/PostgreSQL/17/bin/psql.exe';
const args=['-h','127.0.0.1','-p','55439','-U','brand_test','-d','brand_integrity_test','-v','ON_ERROR_STOP=1','-c'];
function sync(sql){const r=spawnSync(exe,[...args,sql],{encoding:'utf8'});if(r.status)throw Error(r.stderr);}
sync("INSERT INTO brands VALUES ('20000000-0000-4000-8000-000000000001','Race brand','10000000-0000-4000-8000-000000000002',null)");
const writer=spawn(exe,[...args,"BEGIN; INSERT INTO test_quotes VALUES (2,'20000000-0000-4000-8000-000000000001'); SELECT pg_sleep(3); COMMIT;"],{stdio:['ignore','pipe','pipe']});
let ready=false;
writer.stdout.on('data',chunk=>{ if(ready||!String(chunk).includes('INSERT'))return;ready=true;
 const mover=spawn(exe,[...args,"SET lock_timeout='5s'; UPDATE brands SET client_id='10000000-0000-4000-8000-000000000001' WHERE id='20000000-0000-4000-8000-000000000001';"],{stdio:['ignore','pipe','pipe']});
 let err=''; mover.stderr.on('data',d=>err+=d);mover.on('exit',code=>{
  if(code!==1||!err.includes('Linked records prevent')){console.error('FAIL concurrent dependency guard',code,err);process.exitCode=1;return;}
  sync("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM brands WHERE id='20000000-0000-4000-8000-000000000001' AND client_id='10000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Ownership changed'; END IF; IF NOT EXISTS(SELECT 1 FROM test_quotes WHERE id=2 AND brand_id='20000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Dependency lost'; END IF; END $$;");
  console.log('PASS: concurrent dependency insert commits; reassignment rejected; both records preserved');
 });
});
writer.on('exit',code=>{if(code||!ready){console.error('Writer failed');process.exitCode=1;}});
