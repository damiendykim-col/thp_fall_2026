import { readFileSync,writeFileSync } from 'node:fs';
import { MODEL, VERSION, buildRequest,embed,evaluate,fingerprint } from './evaluate.mjs';

const [file,mode='--plan',output]=process.argv.slice(2);
if (!file || !['--plan','--live'].includes(mode)) throw new Error('Usage: node scripts/experiments/taste/run.mjs dataset.json [--plan | --live output.json]');
const dataset=JSON.parse(readFileSync(file,'utf8'));
if (!Array.isArray(dataset.items) || !dataset.items.length || dataset.items.length>12 ||
    new Set(dataset.items.map(i=>i.id)).size!==dataset.items.length ||
    dataset.items.some(i=>typeof i.id!=='string' || !i.id.trim())) throw new Error('Require 1–12 uniquely identified items');
const requests=dataset.items.map(i=>({id:i.id,request:buildRequest(i)}));
// This first baseline deliberately uses reviewed scene text, not image pixels.
if(dataset.items.some(i=>i.images || i.frames || i.imagePath)) throw new Error('This runner is a description-only baseline; pixel/GIF inputs need a separately reviewed dataset');
const trials=dataset.comparisons;
const dummy=Object.fromEntries(requests.map(r=>[r.id,[1,0]]));
evaluate(dummy,trials); // Validate all references before network calls.
console.log(JSON.stringify({model:MODEL,representation:'description-only',requests:requests.length,comparisons:trials.length,judgments:dataset.judgmentsStatus,live:mode==='--live'}));
if(mode==='--live') {
  if(dataset.judgmentsStatus!=='human-reviewed') throw new Error('Review comparison judgments before live evaluation');
  if(!output) throw new Error('Provide a new output path');
  if(!process.env.GEMINI_API_KEY) throw new Error('Supply the key through the environment; .env files are not read');
  const run={model:MODEL,version:VERSION,representation:'description-only',createdAt:new Date().toISOString(),dataset,records:[],status:'running'};
  // Refuse overwrite before incurring any API usage. Preserve partial results on failure.
  writeFileSync(output,JSON.stringify(run,null,2),{flag:'wx',mode:0o600});
  try {
    for(const {id,request} of requests) {
      run.records.push({id,fingerprint:fingerprint(request),request,...await embed(request,process.env.GEMINI_API_KEY)});
      writeFileSync(output,JSON.stringify(run,null,2));
    }
    run.evaluation=evaluate(Object.fromEntries(run.records.map(r=>[r.id,r.vector])),trials);
    run.status='complete';
  } catch(error) {
    run.status='failed';
    throw error;
  } finally {writeFileSync(output,JSON.stringify(run,null,2));}
}
