'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {createHash,createHmac}=require('node:crypto');
const {bootstrap,tokenFor,shutdown,request}=require('./helpers');
const config=require('../src/config');
let server,received=[],upstreamStatus=200;
test.before(async()=>{
 config.superApp.secret='test-only-operator-secret-at-least-32-characters';
 server=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  const h=req.headers,actor=JSON.parse(Buffer.from(h['x-operator-actor'],'base64url').toString());
  const digest=createHash('sha256').update(JSON.stringify(raw?JSON.parse(raw):null)).digest('hex');
  const signature=createHmac('sha256',config.superApp.secret).update([req.method,req.url,h['x-operator-time'],h['x-operator-nonce'],h['x-operator-actor'],digest].join('\n')).digest('hex');
  assert.equal(h['x-operator-signature'],signature);
  received.push({actor,url:req.url,method:req.method});res.writeHead(upstreamStatus,{'Content-Type':'application/json'});
  res.end(JSON.stringify(upstreamStatus===200?{items:[],pagination:{page:1,total:0,totalPages:1}}:{error:'Upstream denied'}));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));config.superApp.url=`http://127.0.0.1:${server.address().port}`;
 await bootstrap();
});
test.after(async()=>{await shutdown();await new Promise(resolve=>server.close(resolve));});
test('panel bridge authenticates both roles, signs fresh server actor and forbids deletion and impersonation',async()=>{
 const {app}=await bootstrap();assert.equal((await request(app).get('/api/super-app/requests')).status,401);
 for(const [username,password,role] of [['admin','admin12345','admin'],['ali.rezaei','operator12345','operator']]){
  const token=await tokenFor(app,username,password,role);
  const response=await request(app).get('/api/super-app/requests?q=car&page=1').set('Authorization',`Bearer ${token}`).set('X-Operator-Actor','forged-browser-actor');
  assert.equal(response.status,200);assert.equal(received.at(-1).actor.role,role);assert.equal(received.at(-1).url,'/api/v1/operator/requests?q=car&page=1');assert.ok(received.at(-1).actor.id);assert.ok(!JSON.stringify(response.body).includes(config.superApp.secret));
  const id='00000000-0000-4000-8000-000000000001';
  const beforeDelete=received.length;
  const deletion=await request(app).post(`/api/super-app/users/${id}/delete`).set('Authorization',`Bearer ${token}`).set('X-Operator-Actor','forged-admin').send({confirmation:'DELETE',phone:'09120000001',reason:'Requested deletion'});
  assert.equal(deletion.status,role==='admin'?200:403);
  assert.equal(received.length,beforeDelete+(role==='admin'?1:0));
  assert.equal((await request(app).get(`/api/super-app/requests/${id}/locations`).set('Authorization',`Bearer ${token}`)).status,200);
  assert.equal((await request(app).post(`/api/super-app/requests/${id}/locations`).set('Authorization',`Bearer ${token}`).send({})).status,200);
  assert.equal(received.at(-1).method,'POST');assert.equal(received.at(-1).url,`/api/v1/operator/requests/${id}/locations`);
  assert.equal((await request(app).post(`/api/super-app/listings/${id}/delete`).set('Authorization',`Bearer ${token}`).send({version:3})).status,200);
  assert.equal(received.at(-1).url,`/api/v1/operator/listings/${id}/delete`);
  for(const path of [`/users/${id}`,`/users/${id}/impersonate`])assert.equal((await request(app).delete('/api/super-app'+path).set('Authorization',`Bearer ${token}`)).status,405);
  for(const [method,path] of [['get','/showrooms'],['get',`/showrooms/${id}/listings`],['patch',`/showrooms/${id}`],['patch',`/showrooms/${id}/gold`],['patch',`/showroom-accounts/${id}`],['post',`/showrooms/${id}/photos`],['post',`/showrooms/${id}/photos/${id}/delete`],['patch',`/listings/${id}`],['get','/imports'],['get','/driver-verifications'],['get',`/driver-verifications/${id}`],['get',`/driver-verifications/${id}/documents/${id}`],['post',`/driver-verifications/${id}/review`],['patch',`/driver-verifications/${id}/profile`]]){
   const operation=request(app)[method]('/api/super-app'+path).set('Authorization',`Bearer ${token}`);
   const result=await (method==='get'?operation:operation.send({version:0}));assert.equal(result.status,200);assert.equal(received.at(-1).url,'/api/v1/operator'+path);
  }
  const count=received.length;assert.equal((await request(app).get('/api/super-app/unknown').set('Authorization',`Bearer ${token}`)).status,405);assert.equal(received.length,count);
  upstreamStatus=403;assert.equal((await request(app).get('/api/super-app/requests').set('Authorization',`Bearer ${token}`)).status,502);upstreamStatus=200;
 }
});
