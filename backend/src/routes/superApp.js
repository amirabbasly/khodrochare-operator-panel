'use strict';
const express=require('express');
const {createHash,createHmac,randomUUID}=require('node:crypto');
const config=require('../config');
const {authRequired,requireRole}=require('../middleware/auth');
const {ApiError,asyncHandler}=require('../utils/http');
const router=express.Router();
router.use(authRequired,requireRole('admin','operator'));
const uuid='[a-f0-9-]{36}';
const allowed={
 GET:new RegExp(`^/(requests(?:/${uuid}(?:/locations)?)?|users(?:/${uuid})?|receipts(?:/${uuid})?|driver-verifications(?:/${uuid}(?:/documents/${uuid})?)?|listings)$`),
 POST:new RegExp(`^/(requests/${uuid}/(confirm|assign|locations)|users/${uuid}/password|listings/${uuid}/review|receipts/${uuid}/review|driver-verifications/${uuid}/review)$`),
 PATCH:new RegExp(`^/(users/${uuid}/active|driver-verifications/${uuid}/profile)$`),
};
router.use(asyncHandler(async(req,res)=>{
 if(!allowed[req.method]?.test(req.path))throw new ApiError(405,'این عملیات در پنل مجاز نیست.');
 const secret=config.superApp.secret;
 if(!secret||secret.length<32)throw new ApiError(503,'اتصال سوپر اپلیکیشن هنوز تنظیم نشده است.');
 let url;try{url=new URL(config.superApp.url);}catch{throw new ApiError(503,'آدرس سوپر اپلیکیشن معتبر نیست.');}
 if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol))throw new ApiError(503,'آدرس اتصال امن معتبر نیست.');
 if(url.protocol==='http:'&&!['localhost','127.0.0.1','app-api','superapp-api'].includes(url.hostname))throw new ApiError(503,'برای اتصال سوپر اپلیکیشن از HTTPS استفاده کنید.');
 url.pathname=url.pathname.replace(/\/+$/,'')+'/api/v1/operator'+req.path;
 url.search=req.url.includes('?')?req.url.slice(req.url.indexOf('?')):'';
 const timestamp=String(Date.now()),nonce=randomUUID();
 const actor=Buffer.from(JSON.stringify({id:String(req.user.id),role:req.user.role,name:[req.user.first_name,req.user.last_name].filter(Boolean).join(' ')})).toString('base64url');
 const body=req.method==='GET'?undefined:JSON.stringify(req.body??{});
 const digest=createHash('sha256').update(JSON.stringify(body===undefined?null:JSON.parse(body))).digest('hex');
 const signature=createHmac('sha256',secret).update([req.method,url.pathname+url.search,timestamp,nonce,actor,digest].join('\n')).digest('hex');
 let response,data;
 try{
  response=await fetch(url,{method:req.method,redirect:'error',headers:{'Content-Type':'application/json','X-Operator-Time':timestamp,'X-Operator-Nonce':nonce,'X-Operator-Actor':actor,'X-Operator-Signature':signature},body,signal:AbortSignal.timeout(20000)});
  const text=await response.text();if(text.length>((req.path.startsWith('/receipts/')||req.path.includes('/documents/'))?8000000:2000000))throw new Error('Oversized response');data=JSON.parse(text);
 }catch{throw new ApiError(502,'ارتباط با سوپر اپلیکیشن برقرار نشد؛ دوباره تلاش کنید.');}
 if(!response.ok){
  if([401,403].includes(response.status))throw new ApiError(502,'تنظیمات اتصال امن پنل به سوپر اپلیکیشن معتبر نیست.');
  throw new ApiError(response.status,typeof data.error==='string'?data.error:'عملیات سوپر اپلیکیشن انجام نشد.');
 }
 const imageBase=new URL(config.superApp.url);
 const prefix=imageBase.origin+imageBase.pathname.replace(/\/+$/,'')+'/api/v1';
 const decorate=row=>row?.photos?{...row,photos:row.photos.map(photo=>({...photo,url:photo.url.startsWith('/hall/')?prefix+photo.url:photo.url}))}:row;
 if(Array.isArray(data.items))data={...data,items:data.items.map(decorate)};else data=decorate(data);
 res.set('Cache-Control','no-store').json(data);
}));
module.exports=router;
