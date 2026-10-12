const fs=require('fs'),path=require('path');
const dependencyRoot=process.env.DRAWER_DEPENDENCY_ROOT||path.join(__dirname,'node_modules');
const esbuild=require(path.join(dependencyRoot,'esbuild'));
const result=esbuild.buildSync({entryPoints:[path.join(__dirname,'app.mjs')],bundle:true,write:false,minify:true,format:'iife',nodePaths:[dependencyRoot],legalComments:'inline',target:'es2020'});
const shell=fs.readFileSync(path.join(__dirname,'shell.html'),'utf8');
const html=shell.replace('/*APP*/',()=>result.outputFiles[0].text.replaceAll('</script','<\\/script'));
const target=path.resolve(__dirname,'../../../../public/works/05-drawer/index.html');
const crypto=require('crypto'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==html)throw Error('Final HTML differs from tested production source rebuild');console.log('PASS reproducible bundle match',hash(html));}
else{fs.writeFileSync(target,html);const provenance={sha256:hash(html),dependencies:Object.fromEntries(['three','fflate','esbuild'].map(x=>[x,JSON.parse(fs.readFileSync(path.join(dependencyRoot,x,'package.json'),'utf8')).version])),sources:Object.fromEntries(['model.mjs','app.mjs','shell.html','build.cjs'].map(x=>[x,hash(fs.readFileSync(path.join(__dirname,x)))]))};fs.writeFileSync(path.join(__dirname,'../build-provenance.json'),JSON.stringify(provenance,null,2));console.log('Built self-contained index.html',Buffer.byteLength(html),provenance.sha256);}
