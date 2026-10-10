import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosine, evaluate, buildRequest } from './evaluate.mjs';

test('cosine rejects invalid and incompatible vectors', () => {
  assert.equal(cosine([1,0],[1,0]),1);
  for (const b of [[1], [0,0], [NaN,1]]) assert.throws(() => cosine([1,0],b));
});
test('evaluation reports ties separately and refuses incompatible dimensions', () => {
  const vectors = { a:[1,0], b:[1,0], c:[0,1] };
  const trials = [{anchor:'a',positive:'b',negative:'c'}];
  assert.equal(evaluate(vectors,trials).wins,1);
  assert.equal(evaluate({...vectors,c:[1,0]},trials).ties,1);
  assert.throws(() => evaluate({a:[1,0],b:[1],c:[0,1]},trials));
  assert.throws(() => evaluate(vectors,[]));
});
test('model input excludes judgments and uses scene/caption only', () => {
  const request=buildRequest({scene:'A desk',caption:'My office moved into my bed.',expectedStyle:'absurd'},[]);
  assert.equal(request.model,'models/gemini-embedding-2');
  assert.equal(request.content.parts.length,1);
  assert.ok(!JSON.stringify(request).includes('expectedStyle'));
});
test('six-frame provider limit never silently truncates confirmed frames', () => {
  assert.throws(()=>buildRequest({scene:'A GIF',caption:'Wait for it.'},Array(7).fill({inlineData:{mimeType:'image/jpeg',data:'AA=='}})));
});

test('embedding request records usage and rejects provider failures without retry', async () => {
  const {embed}=await import('./evaluate.mjs');
  let calls=0;
  const request=buildRequest({scene:'A desk',caption:'The meeting could have been a nap.'});
  const result=await embed(request,'test-key',async(_url, options)=> {
    calls++;
    assert.equal(JSON.parse(options.body).content.parts.length,1);
    return {ok:true,json:async()=>({embedding:{values:[1,0]},usageMetadata:{promptTokenCount:12}})};
  });
  assert.equal(result.dimensions,2);
  assert.equal(result.usage.promptTokenCount,12);
  await assert.rejects(()=>embed(request,'test-key',async()=>{calls++;return {ok:false,status:429};}),/429/);
  assert.equal(calls,2);
});
