const ROOT=require('node:path').resolve(__dirname,'../..'),FIXTURES=ROOT+'/.artifacts/v4-blocks',UPGRADE=ROOT+'/src/upgrades';
// Unit harness for real controller transaction functions, not a browser/DOM test.
const fs=require('fs'),vm=require('vm'),ts=require('typescript'),{final}=require('./load_final.cjs');
const ix={1:2,2:2,3:2,4:2,5:2,6:2,7:1,8:4,9:1,10:2,11:4,12:4,13:4,14:3,15:2,16:2,17:4,18:2,19:4,20:2,21:2,22:4,23:4,24:2,25:4,26:5,27:3,28:3,29:3,30:3};
const strip=x=>JSON.stringify(x);let reports=[];
function element(){const o={value:'',style:{},dataset:{},width:900,height:600,clientWidth:900,clientHeight:600,textContent:'',hidden:false,disabled:false,childNodes:[{textContent:''}],classList:{add(){},remove(){},toggle(){},contains(){return false}},getBoundingClientRect:()=>({width:900,height:600,x:0,y:0,left:0,top:0,right:900,bottom:600}),getAttribute:()=>null,setAttribute(){},removeAttribute(){},getContext:()=>new Proxy({measureText:t=>({width:String(t).length*8}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(t,p)=>t[p]||(()=>{})}),addEventListener(){},querySelectorAll:()=>[],querySelector:()=>element(),replaceChildren(){},append(){},appendChild(){},before(){},after(){},remove(){},setPointerCapture(){},hasPointerCapture:()=>false,releasePointerCapture(){},focus(){},click(){},scrollIntoView(){}};return o;}
for(const id of fs.readdirSync(FIXTURES).filter(x=>/^\d\d-/.test(x)&&parseInt(x)>=+(process.argv[2]||1)&&parseInt(x)<=+(process.argv[3]||30))){
 const n=parseInt(id),{c}=final(id),els={};try{
 Object.assign(c,{window:null,addEventListener(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},setInterval:()=>1,clearInterval(){},matchMedia:()=>({matches:false,addEventListener(){}}),localStorage:{setItem(){},getItem(){return null}},confirm:()=>true,ResizeObserver:class{observe(){}disconnect(){}}});c.window=c;
 c.document={hidden:false,activeElement:null,getElementById:k=>els[k]||(els[k]=element()),querySelector:()=>element(),querySelectorAll:()=>[],createElement:()=>element(),addEventListener(){},body:element(),head:element()};
 if(c.Atelier3D){c.Atelier3D.Renderer=class {render(){}resize(){}dispose(){}};c.Atelier3D.Orbit=class{constructor(can,cam){this.camera=cam||{position:[4,4,4],target:[0,0,0]};this.radius=8;}sync(){}dispose(){}rotate(){}zoom(){}pan(){}};}
 let src=JSON.parse(fs.readFileSync(FIXTURES+'/'+id+'/blocks-final.json','utf8'))[ix[n]].text;
 const tree=ts.createSourceFile('controller.js',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let fn;
 function find(node){if((ts.isFunctionExpression(node)||ts.isArrowFunction(node))&&ts.isBlock(node.body)&&node.body.statements.some(s=>s.getText(tree).startsWith('globalThis.AtelierBridge=')))fn=node;ts.forEachChild(node,find);}find(tree);if(!fn)throw Error('Bridge IIFE not found');
 const statements=fn.body.statements;const setup=statements.filter(s=>ts.isVariableStatement(s)||ts.isFunctionDeclaration(s)).map(s=>s.getText(tree)).join('\n');
 const bridge=statements.find(s=>s.getText(tree).startsWith('globalThis.AtelierBridge=')).getText(tree);
 // Stub visual scheduling and messages only; leave actual native commit/history/data logic.
 const visuals=['render','renderUI','draw','redraw','paint','sync','syncUI','schedule','scheduleDraw','requestDraw','queueDraw','updateUI','renderTimer','syncHistory','note','msg','message','tell','say','notice','notify','saveDraft','persist','store','backup','remember','save','saveTemp','queueDraft','draft','inspector','totals','controls','form','numbers','table','build','rebuild','update','setDisabled','stopAnimation','changed'];
 const declared=new Set(statements.filter(ts.isFunctionDeclaration).map(s=>s.name?.text));let overrides=visuals.filter(n=>declared.has(n)).map(n=>`${n}=function(){};`).join('\n');
 // Set minimal live Orbit only if lexical renderer initialization would otherwise occur in excluded try.
 const vartext=statements.filter(ts.isVariableStatement).map(s=>s.getText(tree)).join('\n');
 let fix='';if(n===6)fix="orbit=new A.Orbit(c,s.camera);renderer=new A.Renderer(c);";
 if(n===29)fix="$ ('corpus').value=state.corpus;$('seed').value=state.seed;";
 if(n===30)fix="for(const k of ['method','chunk','overlap','k1','b','k','budget'])$(k).value=s.params[k];";
 if(n===4)fix="history=new S.ProjectHistory(state);"; // inspect real initialization if needed
 vm.runInContext('(function(){'+setup+'\n'+overrides+'\n'+fix+'\n'+bridge+'})()',c,{timeout:25000});
 const first=c.AtelierLab.validate(c.AtelierBridge.capture());const expectations=c.AtelierLab.metrics(first);const parsed=c.AtelierLab.validate(JSON.parse(JSON.stringify(first)));if(strip(c.AtelierLab.metrics(parsed))!==strip(expectations))throw Error('Serialized version metrics differ');c.AtelierBridge.restore(parsed);
 if(strip(c.AtelierLab.metrics(c.AtelierLab.validate(c.AtelierBridge.capture())))!==strip(expectations))throw Error('Initial transaction metrics changed');
 let variants=c.AtelierLab.variants(first),out=[];
 for(const v of variants){if(v.error){out.push({name:v.name,rejected:v.error});continue;}c.AtelierBridge.restore(v.payload);if(n===30){/* visual render stub does not sync form values; emulate values only for draft check */ const pp=v.payload.params;for(const k of ['method','chunk','overlap','k1','b','k','budget'])els[k].value=pp[k];}
 const actual=c.AtelierLab.validate(c.AtelierBridge.capture());const a=c.AtelierLab.metrics(actual),b=c.AtelierLab.metrics(v.payload);if(strip(a)!==strip(b))throw Error('Native apply mismatched '+v.name+'\n'+strip(a)+'\n'+strip(b));out.push({name:v.name,pass:true});}
 reports.push({id,pass:true,jsonRoundTrip:true,variants:out,scope:'Original controller transaction functions executed with visual scheduling and DOM outputs stubbed; not browser testing.'});console.log(id,'PASS');
 }catch(e){reports.push({id,pass:false,error:String(e.stack).slice(0,3000)});console.log(id,'FAIL',String(e.stack).slice(0,1800));}
}
fs.writeFileSync(__dirname+'/bridge-test-'+(process.argv[2]||1)+'.json',JSON.stringify(reports,null,2));
