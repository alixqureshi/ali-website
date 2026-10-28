import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {test} from 'node:test';
let handler, requests=[];
const env={STRIPE_WEBHOOK_SECRET:'whsec_testfixture',META_ACCESS_TOKEN:'fixture',META_PIXEL_ID:'1167132298977136'};
globalThis.Bun={env,serve:o=>{handler=o.fetch;}};
globalThis.fetch=async(url,opts)=>{requests.push({url,body:JSON.parse(opts.body)});return Response.json({events_received:1});};
await import('./meta-capi.ts');
const session=()=>({id:'cs_live_fixture',object:'checkout.session',livemode:true,mode:'payment',payment_status:'paid',amount_total:9700,currency:'usd',payment_link:'plink_1UUtKzGUKYQC9sJNfefzx2NZ',customer_details:{email:'TEST@EXAMPLE.COM',name:'Buyer Test'},client_reference_id:'a1-1-1234567890000-12345-1-1234567890000-clickid'});
const event=()=>({id:'evt_fixture',livemode:true,created:Math.floor(Date.now()/1000),type:'checkout.session.completed',data:{object:session()}});
async function send(e,options={}){requests=[];const raw=typeof e==='string'?e:JSON.stringify(e);const t=options.t??Math.floor(Date.now()/1000);const sig=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(`${t}.${raw}`).digest('hex');return handler(new Request('https://test.local/stripe/webhook',{method:'POST',body:raw,headers:{'stripe-signature':options.signature??`t=${t},v1=${sig}`}}));}
test('valid $97 signed purchase forwards hashed data and stable dedup ID',async()=>{const r=await send(event());assert.equal(r.status,200);assert.equal(requests.length,1);const e=requests[0].body.data[0];assert.equal(e.event_id,'cs_live_fixture');assert.equal(e.custom_data.value,97);assert.equal(e.custom_data.currency,'USD');assert.equal(e.user_data.em[0].length,64);assert.equal(e.user_data.fbp,'fb.1.1234567890000.12345');assert.equal(e.user_data.fbc,'fb.1.1234567890000.clickid');});
for(const [name,change] of [
 ['unpaid',e=>e.data.object.payment_status='unpaid'],
 ['test session',e=>e.data.object.livemode=false],
 ['test event',e=>e.livemode=false],
 ['other payment link',e=>e.data.object.payment_link='plink_wrong'],
 ['forged success URL for other link',e=>{e.data.object.payment_link='plink_wrong';e.data.object.success_url='https://aliqureshi.co/workshops/build-your-ai-brain/booked/evil';}],
 ['invalid session',e=>e.data.object.id='cs_test_fixture'],
 ['zero amount',e=>e.data.object.amount_total=0],
 ['subscription',e=>e.data.object.mode='subscription'],
 ['other event',e=>e.type='payment_intent.succeeded'],
 ['visitor opted out',e=>e.data.object.client_reference_id='optout']
])test(`skips ${name} without forwarding`,async()=>{const e=event();change(e);assert.equal((await send(e)).status,200);assert.equal(requests.length,0);});
test('accepts delayed payment success',async()=>{const e=event();e.type='checkout.session.async_payment_succeeded';assert.equal((await send(e)).status,200);assert.equal(requests.length,1);});
test('retry keeps same event ID',async()=>{await send(event());const first=requests[0].body.data[0].event_id;await send(event());assert.equal(requests[0].body.data[0].event_id,first);});
for(const [name,options] of [['bad signature',{signature:'t=1,v1=invalid'}],['expired timestamp',{t:1}],['non-numeric timestamp',{t:'NaN'}]])test(`rejects ${name}`,async()=>{assert.equal((await send(event(),options)).status,400);assert.equal(requests.length,0);});
test('malformed JSON returns 400',async()=>assert.equal((await send('{')).status,400));
test('uses actual tax inclusive amount',async()=>{const e=event();e.data.object.amount_total=11640;await send(e);assert.equal(requests[0].body.data[0].custom_data.value,116.4);});
test('handles zero decimal currency',async()=>{const e=event();e.data.object.currency='jpy';e.data.object.amount_total=15000;await send(e);assert.equal(requests[0].body.data[0].custom_data.value,15000);});
test('Meta failure returns retryable 502',async()=>{const f=globalThis.fetch;globalThis.fetch=async()=>new Response('error',{status:500});assert.equal((await send(event())).status,502);globalThis.fetch=f;});
test('Meta no acceptance returns retryable 502',async()=>{const f=globalThis.fetch;globalThis.fetch=async()=>Response.json({events_received:0});assert.equal((await send(event())).status,502);globalThis.fetch=f;});
