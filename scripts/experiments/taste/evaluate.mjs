import { createHash } from 'node:crypto';

export const MODEL = 'gemini-embedding-2';
export const VERSION = 'taste-scene-caption-v1';
export function cosine(a,b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length!==b.length ||
    ![...a,...b].every(Number.isFinite)) throw new Error('Invalid or incompatible vectors');
  const norm=v=>Math.hypot(...v);
  const na=norm(a), nb=norm(b);
  if (!na || !nb || !Number.isFinite(na*nb)) throw new Error('Invalid vector norm');
  return a.reduce((sum,x,i)=>sum+x*b[i],0)/(na*nb);
}
export function evaluate(vectors,trials) {
  if (!trials.length) throw new Error('No reviewed comparisons');
  const rows=trials.map(({anchor,positive,negative})=> {
    if (new Set([anchor,positive,negative]).size!==3) throw new Error('Comparison needs three distinct items');
    const margin=cosine(vectors[anchor],vectors[positive])-cosine(vectors[anchor],vectors[negative]);
    return {anchor,positive,negative,margin,result:Math.abs(margin)<1e-9?'tie':margin>0?'win':'loss'};
  });
  return {wins:rows.filter(r=>r.result==='win').length,ties:rows.filter(r=>r.result==='tie').length,total:rows.length,rows};
}
export function buildRequest(item, imageParts=[]) {
  if (imageParts.length>6) throw new Error('Embedding 2 accepts at most six images; review a separate representation first');
  if (![item.scene,item.caption].every(v=>typeof v==='string' && v.trim() && v.length<=1000)) throw new Error('Scene/caption required, at most 1000 characters each');
  return {model:`models/${MODEL}`,content:{parts:[{text:`Scene: ${item.scene}\nCaption: ${item.caption}`},...imageParts]}};
}
export const fingerprint=request=>createHash('sha256').update(JSON.stringify({version:VERSION,request})).digest('hex');
export async function embed(request,key,fetcher=fetch) {
  if (!key) throw new Error('GEMINI_API_KEY must be supplied by the operator');
  const start=performance.now();
  const response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
    signal:AbortSignal.timeout(30000),body:JSON.stringify(request),
  });
  // Never print provider bodies: they may echo supplied content or credentials.
  if (!response.ok) throw new Error(`Embedding request failed (HTTP ${response.status}); no automatic retry`);
  const data=await response.json();
  const vector=data.embedding?.values;
  cosine(vector,vector);
  return {vector,dimensions:vector.length,latencyMs:Math.round(performance.now()-start),usage:data.usageMetadata??null};
}
