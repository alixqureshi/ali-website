import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('./meta-capi.ts',import.meta.url));
const source=readFileSync(path,'utf8');
const adapter=readFileSync(new URL('./kit-fulfillment.ts',import.meta.url),'utf8').replace(/^export /gm,'');
const block='// BEGIN INLINED KIT FULFILLMENT\n'+adapter.trimEnd()+'\n// END INLINED KIT FULFILLMENT';
const next=source.replace(/\/\/ BEGIN INLINED KIT FULFILLMENT[\s\S]*?\/\/ END INLINED KIT FULFILLMENT/,block);
if(!source.includes('// BEGIN INLINED KIT FULFILLMENT'))throw Error('Missing inline boundary');
if(process.argv.includes('--check')){if(source!==next)throw Error('Run node sync-fulfillment.mjs before deploying');}
else writeFileSync(path,next);
