// Development-only input; the grader supplies the production snapshot separately.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const snapshotPath=resolve(process.env.RADAR_SNAPSHOT || '/root/.hermes/cache/scratch/token-radar-work/token-radar-01-kit/input/snapshot.json');
export const snapshotText=(()=>{
  try{return readFileSync(snapshotPath,'utf8');}
  catch(cause){throw new Error(`Local kit snapshot unavailable at ${snapshotPath}. Set RADAR_SNAPSHOT to the authentic kit input/snapshot.json; do not copy it into the repository.`,{cause});}
})();
