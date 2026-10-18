import {build} from 'esbuild';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
await build({entryPoints:[path.join(root,'src/app.js')],bundle:true,format:'esm',platform:'browser',target:['es2020'],outfile:path.join(dist,'app.js'),minify:true,logLevel:'warning'});
await Promise.all(['index.html','styles.css'].map(async name=>{
  const contents=await readFile(path.join(root,name),'utf8');
  await writeFile(path.join(dist,name),contents);
}));
console.log('Built Dead Drop browser game into dist/');
