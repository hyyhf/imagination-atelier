const ROOT=require('node:path').resolve(__dirname,'../..'),FIXTURES=ROOT+'/.artifacts/v4-blocks',UPGRADE=ROOT+'/src/upgrades';
const fs=require('fs'),vm=require('vm');
const {Canvas}=require('skia-canvas');
const factory=(w,h)=>new Canvas(w,h);
function load(id,blocksPath){
 const blocks=JSON.parse(fs.readFileSync(blocksPath||`${FIXTURES}/${id}/blocks-final.json`,'utf8'));
 const c={console,Math,Date,JSON,Number,String,Boolean,Object,Array,Set,Map,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int16Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,Blob,URL,performance,structuredClone,atob,btoa,parseInt,parseFloat,isFinite,setTimeout,clearTimeout};
 c.ArtworkCanvasFactory=factory; c.document={createElement:tag=>tag==='canvas'?factory(600,400):{}};
 vm.createContext(c);
 blocks.forEach((b,i)=>{
  if(((b.text.includes('getElementById')||b.text.includes('querySelector'))&&!b.text.includes('Atelier3D — dependency')) || (b.type&&!['text/javascript','application/javascript','module'].includes(b.type)))return;
  vm.runInContext(b.text,c,{filename:id+'/'+i+'.js',timeout:15000});
 });
 if(c.SceneApp?.configure)c.SceneApp.configure(factory);
 let state=(c.AppModel||c.SceneApp||c.Artwork).initialState();
 return {c,state,factory};
}
module.exports={load};
if(require.main===module){
 for(const id of fs.readdirSync(FIXTURES).filter(x=>/^\d\d-/.test(x))){try{const {c,state}=load(id);console.log(id,Object.keys(c.AppModel||c.SceneApp||c.Artwork).join(','),JSON.stringify(state).slice(0,500));}catch(e){console.log(id,'ERROR',String(e).slice(0,250))}}
}
