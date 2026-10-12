const ROOT=require('node:path').resolve(__dirname,'../..'),FIXTURES=ROOT+'/.artifacts/v4-blocks',UPGRADE=ROOT+'/src/upgrades';
const {load}=require('./load.cjs'),fs=require('fs'),vm=require('vm');
function final(id){const path=FIXTURES+'/'+id+'/blocks-final.json';const o=load(id,path);vm.runInContext(fs.readFileSync(UPGRADE+'/lab.js','utf8').replace('__CASE_ID__',parseInt(id)),o.c);if(o.c.Atelier3D)vm.runInContext(fs.readFileSync(UPGRADE+'/spatial.js','utf8').replace('__CASE_ID__',parseInt(id)),o.c);return o;}
module.exports={final};
