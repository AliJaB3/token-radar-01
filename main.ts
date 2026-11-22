import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBoard, liveProtocols, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root=fileURLToPath(new URL('.',import.meta.url));
function option(name:string,fallback:string):string { const i=process.argv.indexOf(`--${name}`); return i>=0?process.argv[i+1]??fallback:process.env[name==='output'?'MAKEFUN_OUTPUT_DIR':'MAKEFUN_INPUT_DIR']??fallback; }
const inputArg=option('input','/input'), input=inputArg.endsWith('.json')?inputArg:join(inputArg,'snapshot.json');
const out=option('output','/output');
if(!existsSync(input)){process.stderr.write(`Missing snapshot: ${input}\n`);process.exit(2);}
const snapshot=parseSnapshot(readFileSync(input,'utf8'));
const {rows,calibration_ratio,calibration_peer_count,eligible_count,validation}=buildBoard(snapshot);
if(rows.length<100||snapshot.watchlist.some(s=>!rows.some(r=>r.slug===s)))throw new Error('Board coverage or minimum size check failed');
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'board.json'),JSON.stringify({as_of:snapshot.as_of,calibration_ratio,validation,rows},null,2)+'\n');
const data={as_of:snapshot.as_of,source:snapshot.source,floor_usd:snapshot.floor_usd,watchlist:snapshot.watchlist,watchlist_size:snapshot.watchlist.length,eligible_count,calibration_ratio,calibration_peer_count,validation,rows,live:liveProtocols(snapshot),protocols:snapshot.protocols};
writeFileSync(join(out,'data.js'),`window.RADAR_DATA=${JSON.stringify(data)};\n`);
function copyTree(from:string,to:string):string[]{mkdirSync(to,{recursive:true});const names:string[]=[];for(const name of readdirSync(from)){if(name.startsWith('.'))continue;const src=join(from,name),dest=join(to,name);if(statSync(src).isFile()){copyFileSync(src,dest);names.push(name);}else if(statSync(src).isDirectory())names.push(...copyTree(src,dest).map(x=>`${name}/${x}`));}return names;}
copyTree(join(root,'dashboard'),join(out,'dashboard'));
const shots=copyTree(join(root,'screenshots'),join(out,'screenshots'));
if(process.argv.includes('--preview')){
  process.stdout.write(`Preview: ${rows.length} ranked rows, ${snapshot.watchlist.length} watchlist records, ${validation.holdout_count} held-out comparables, data.js and dashboard written to ${out}. Dossier requires real screenshots.\n`);
  process.exit(0);
}
if(shots.length<3)throw new Error(`Need three real dashboard screenshots; found ${shots.length}`);
const dossier=buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}});
if(dossier.byteLength>1572864)throw new Error('Dossier exceeds the competition limit of 1.5 MiB');
writeFileSync(join(out,'dossier.json'),dossier);
process.stdout.write(`Built ${rows.length} ranked rows from ${eligible_count} eligible protocols; ${snapshot.watchlist.length}/${snapshot.watchlist.length} watchlist records covered; ${liveProtocols(snapshot).length} token-recorded protocols separated. Snapshot ${snapshot.as_of}, peer median mcap/TVL ${calibration_ratio.toFixed(4)}.\n`);
