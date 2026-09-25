// Local browser regression fixture: node scripts/check-shortcut-targets.cjs
const http = require('node:http');
const fs = require('node:fs');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('lib/productivity/shortcut-targets.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const html = `<!doctype html><title>Shortcut regression checks</title><button id="run">Run checks</button><pre id="result"></pre><div id="fixture"></div><script type="module">
import {resolveSaveTarget,closeShortcutPane} from '/targets.js';
const f=document.getElementById('fixture'), output=document.getElementById('result');
document.getElementById('run').onclick=()=>{
 let passed=0; const check=(ok,name)=>{if(!ok)throw Error(name);passed++};
 try {
 f.innerHTML='<button id="background">Save page</button><section data-shortcut-pane><button id="pane">Save line</button><button data-shortcut-close>Close</button></section>';
 check(resolveSaveTarget().button?.id==='pane','pane overrides background');
 let closed=0;f.querySelector('[data-shortcut-close]').onclick=()=>closed++;
 check(closeShortcutPane()&&closed===1,'Escape uses close callback');
 f.insertAdjacentHTML('beforeend','<div role="dialog"><button id="dialog">Save profile</button></div>');
 check(resolveSaveTarget().button?.id==='dialog','dialog overrides pane');
 check(!closeShortcutPane()&&closed===1,'Escape does not close pane behind dialog');
 f.querySelector('[role=dialog]').innerHTML='<button>Delete payment</button>';
 check(!resolveSaveTarget().button&&resolveSaveTarget().scoped,'delete dialog blocks background save');
 f.innerHTML='<div hidden><button>Save hidden</button></div><button id="only">Save page</button>';
 check(resolveSaveTarget().button?.id==='only','hidden save ignored');
 f.innerHTML='<button>Save one</button><button>Save two</button>';
 check(resolveSaveTarget().ambiguous&&!resolveSaveTarget().button,'multiple unrelated saves not guessed');
 f.innerHTML='<form id="one"><input id="focus"><button>Save one</button></form><form><button>Save two</button></form>';
 f.querySelector('#focus').focus();check(resolveSaveTarget().button?.form?.id==='one','focused form wins');
 f.innerHTML='<form id="external"></form><input id="focus" form="external"><button form="external" id="external-save">Save payment changes</button><button>Save payment</button>';
 f.querySelector('#focus').focus();check(resolveSaveTarget().button?.id==='external-save','external form association');
 f.innerHTML='<section data-shortcut-pane><button id="disabled" disabled>Save line</button></section><button>Save background</button>';
 check(resolveSaveTarget().button?.id==='disabled','disabled pane cannot fall through');
 f.innerHTML='';output.textContent=passed+' checks passed';
 }catch(e){output.textContent='FAIL: '+e.message;}
};</script>`;
http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/targets.js'?'text/javascript':'text/html');res.end(req.url==='/targets.js'?source:html)}).listen(4319,'127.0.0.1',()=>console.log('Shortcut checks: http://127.0.0.1:4319'));
