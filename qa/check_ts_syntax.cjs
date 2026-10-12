// Syntax diagnostics only. This DOES NOT replace npm ci + tsc --noEmit.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const files = [...fs.readdirSync(path.join(root, 'src')).filter(f => /\.tsx?$/.test(f)).map(f => 'src/' + f), 'vite.config.ts'];
let failures = [];
for (const file of files) {
 const result = ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), {fileName:file, reportDiagnostics:true, compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,isolatedModules:true}});
 for (const d of result.diagnostics || []) if (d.category === ts.DiagnosticCategory.Error) failures.push({file,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')});
}
const report = {scope:'Syntax transpilation only; does not check external dependency types or production bundling', typescript:ts.version, files, failures, pass:failures.length===0};
fs.mkdirSync(path.join(root,'.artifacts'),{recursive:true});
fs.writeFileSync(path.join(root,'.artifacts/tsx-syntax.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
