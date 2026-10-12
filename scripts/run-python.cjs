#!/usr/bin/env node
// Cross-platform Python launcher for npm scripts. Does not install anything.
const {spawnSync} = require('node:child_process');
const candidates = process.platform === 'win32' ? [['py','-3'],['python'],['python3']] : [['python3'],['python']];
// uv-managed Python may be installed without a python/python3 PATH alias.
const managed = spawnSync('uv', ['python', 'find', '>=3.10', '--offline', '--no-python-downloads'], {encoding:'utf8', windowsHide:true});
if (managed.status === 0 && managed.stdout.trim()) candidates.push([managed.stdout.trim()]);
// Project content is UTF-8, including on Windows with a legacy system code page.
const env = {...process.env, PYTHONUTF8:'1'};
for (const [command,...prefix] of candidates) {
 const probe=spawnSync(command,[...prefix,'-c','import sys; print(int(sys.version_info >= (3,10)))'],{encoding:'utf8',windowsHide:true});
 if (probe.status!==0 || probe.stdout.trim()!=='1')continue;
 const result=spawnSync(command,[...prefix,...process.argv.slice(2)],{stdio:'inherit',env,windowsHide:true});
 if(result.error){console.error(result.error.message);process.exit(1);}
 process.exit(result.status===null?1:result.status);
}
console.error('Python 3.10+ is required to prepare the offline catalog and release archives. Install Python, then rerun.');
process.exit(1);
