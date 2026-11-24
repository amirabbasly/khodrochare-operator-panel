 'use client';
import {useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import {faDateTime} from '@/lib/format';

const valid=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
const stamp=value=>value?faDateTime(value):'—';
const project=(point,zoom)=>{const size=256*2**zoom,lat=Math.max(-85.0511,Math.min(85.0511,point.latitude))*Math.PI/180;return{x:(point.longitude+180)/360*size,y:(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*size};};
const unproject=(x,y,zoom)=>{const size=256*2**zoom;return{longitude:x/size*360-180,latitude:Math.atan(Math.sinh(Math.PI*(1-2*y/size)))*180/Math.PI};};
const reasons={REQUEST_CREATED:'هنگام ثبت درخواست',DRIVER_ACCEPTED:'هنگام پذیرش امدادگر',OPERATOR_ASSIGNED:'هنگام تخصیص امدادگر',OPERATOR_CAPTURE:'ثبت دستی اپراتور'};
const colors={origin:'#7c3aed',customer:'#0369a1',driver:'#c2410c'};
function LocationMap({points,identity}){
 const host=useRef(null),drag=useRef(null);
 const [width,setWidth]=useState(600),[view,setView]=useState(null);
 const usable=points.filter(item=>valid(item.point));
 const signature=usable.map(item=>item.key).join(',');
 function fit(){if(!usable.length)return;const latitude=usable.reduce((sum,p)=>sum+p.point.latitude,0)/usable.length,longitude=usable.reduce((sum,p)=>sum+p.point.longitude,0)/usable.length;let zoom=16;for(;zoom>3;zoom--){const projected=usable.map(p=>project(p.point,zoom));if(Math.max(...projected.map(p=>p.x))-Math.min(...projected.map(p=>p.x))<width-110&&Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y))<230)break;}setView({latitude,longitude,zoom});}
 useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));if(host.current)observer.observe(host.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{fit();},[identity,signature]); // Keep operator pan/zoom stable during live updates.
 const zoom=view?.zoom??12,center=project(view||{latitude:35.7,longitude:51.4},zoom),left=center.x-width/2,top=center.y-180,tiles=[];
 for(let y=Math.floor(top/256);y<=Math.floor((top+360)/256);y++)for(let x=Math.floor(left/256);x<=Math.floor((left+width)/256);x++){const n=2**zoom;if(y<0||y>=n)continue;const wrapped=((x%n)+n)%n;tiles.push(<img key={`${zoom}-${x}-${y}`} src={`https://tile.openstreetmap.org/${zoom}/${wrapped}/${y}.png`} alt="" draggable="false" referrerPolicy="no-referrer" style={{position:'absolute',width:256,height:256,maxWidth:'none',left:x*256-left,top:y*256-top}}/>);}
 return <div><div ref={host} className="request-location-map" tabIndex={0} role="region" onKeyDown={event=>{const delta={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-80],ArrowDown:[0,80]}[event.key];if(!delta||!usable.length)return;event.preventDefault();setView({...unproject(center.x+delta[0],center.y+delta[1],zoom),zoom});}} aria-label="نقشه موقعیت مشتری، امدادگر و مبدأ درخواست" onPointerDown={event=>{if(event.target.closest('button,a'))return;drag.current={x:event.clientX,y:event.clientY,center,zoom};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(!drag.current)return;const start=drag.current;setView({...unproject(start.center.x-event.clientX+start.x,start.center.y-event.clientY+start.y,start.zoom),zoom:start.zoom});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
 {usable.length?tiles:<p className="location-map-empty">موقعیتی برای نمایش ثبت نشده است.</p>}
 {usable.map(item=>{const p=project(item.point,zoom);return <span key={item.key} className="request-location-marker" style={{left:p.x-left,top:p.y-top,background:colors[item.key]}} title={`${item.label} · ${item.point.latitude}, ${item.point.longitude}`}><span>{item.label}</span></span>;})}
 <div className="request-map-controls"><button type="button" aria-label="بزرگ‌نمایی نقشه" disabled={!usable.length||zoom>=18} onClick={()=>setView(v=>({...v,zoom:Math.min(18,zoom+1)}))}>+</button><button type="button" aria-label="کوچک‌نمایی نقشه" disabled={!usable.length||zoom<=3} onClick={()=>setView(v=>({...v,zoom:Math.max(3,zoom-1)}))}>−</button><button type="button" onClick={fit} disabled={!usable.length}>نمایش همه</button></div>
 <a className="request-map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
 </div><p className="text-sm text-muted">برای جابه‌جایی نقشه بکشید. موقعیت قدیمی با برچسب مشخص شده است.</p></div>;
}
export default function RequestLocations({requestId}){
 const [requests,setRequests]=useState([]),[selected,setSelected]=useState(''),[search,setSearch]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[history,setHistory]=useState(''),[revision,setRevision]=useState(0);
 const savingRef=useRef(false),id=requestId||selected;
 useEffect(()=>{if(requestId)return;const c=new AbortController(),timer=setTimeout(()=>{api.get('/super-app/requests',{limit:50,q:search},{signal:c.signal}).then(value=>setRequests(value.items)).catch(e=>{if(!c.signal.aborted)setError(e.message);});},300);return()=>{clearTimeout(timer);c.abort();};},[requestId,search]);
 useEffect(()=>{setData(null);setHistory('');setNotice('');setError('');},[id]);
 useEffect(()=>{if(!id)return;const c=new AbortController();let running=false;async function refresh(){if(running||c.signal.aborted)return;running=true;try{const value=await api.get(`/super-app/requests/${id}/locations`,{},{signal:c.signal});if(!c.signal.aborted){setData(value);setError('');}}catch(e){if(!c.signal.aborted)setError(e.message);}finally{running=false;}}void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},5000);return()=>{c.abort();clearInterval(timer);};},[id,revision]);
 async function capture(){if(savingRef.current)return;savingRef.current=true;setSaving(true);setNotice('');setError('');try{await api.post(`/super-app/requests/${id}/locations`,{});setNotice('موقعیت‌های دریافتی همراه زمان و نام اپراتور ثبت شدند.');setRevision(v=>v+1);}catch(e){setError(e.message);}finally{savingRef.current=false;setSaving(false);}}
 const snapshot=data?.snapshots?.find(row=>row.id===history),locations=snapshot?.locations||data?.current;
 const now=Date.now(),points=[{key:'origin',label:'مبدأ زمان درخواست',point:locations?.origin},{key:'customer',label:'مشتری',point:locations?.customer},{key:'driver',label:'امدادگر',point:locations?.driver}].map(item=>({...item,stale:item.key!=='origin'&&valid(item.point)&&now-Date.parse(item.point.recordedAt)>(data?.maxAgeSeconds||120)*1000}));
 return <section className="request-locations" aria-labelledby={requestId?'request-location-heading':'location-monitor-heading'}><h2 id={requestId?'request-location-heading':'location-monitor-heading'}>موقعیت دقیق مشتری و امدادگر</h2>
 {!requestId&&<div className="superapp-filters"><label>جست‌وجوی درخواست<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="نام، شماره یا خودرو"/></label><label>درخواست برای نمایش روی نقشه<select disabled={saving} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">انتخاب درخواست</option>{requests.map(row=><option key={row.id} value={row.id}>{row.customer?.fullName||'مشتری'} · {row.vehicleName} · {stamp(row.createdAt)}</option>)}</select></label></div>}
 {error&&<p role="alert" className="text-danger">{error}{data?'؛ اطلاعات قبلی نمایش داده می‌شود.':''}</p>}{notice&&<p role="status" className="text-success">{notice}</p>}
 {!id?<p>درخواست را انتخاب کنید تا موقعیت طرفین و سوابق ثبت‌شده نمایش داده شود.</p>:!data&&!error?<p role="status">در حال دریافت موقعیت‌ها…</p>:data&&<>
 <p>{data.customerName} · {data.driverName||'امدادگر هنوز تخصیص نیافته'} · آخرین دریافت: {stamp(data.generatedAt)}</p>
 <div className="superapp-filters"><label>موقعیت زنده یا سابقه ثبت<select value={history} onChange={e=>setHistory(e.target.value)}><option value="">آخرین موقعیت دریافتی (به‌روزرسانی هر ۵ ثانیه)</option>{data.snapshots.map(row=><option key={row.id} value={row.id}>{stamp(row.capturedAt)} · {reasons[row.reason]||'ثبت موقعیت'} · {row.actorName}</option>)}</select></label><button type="button" className="btn btn-primary" disabled={saving||!!error} onClick={capture}>{saving?'در حال ثبت…':'ثبت موقعیت فعلی طرفین'}</button><button type="button" className="btn btn-outline" onClick={()=>setRevision(v=>v+1)}>دریافت مجدد موقعیت</button></div>
 {snapshot&&<p role="status">سابقه ذخیره‌شده در {stamp(snapshot.capturedAt)} توسط {snapshot.actorName}؛ این نما زنده نیست.</p>}
 <LocationMap points={points.map(item=>({...item,label:item.label+(item.stale?' (قدیمی)':'')}))} identity={`${id}-${history}`}/>
 <div className="request-location-cards">{points.map(item=><article key={item.key}><h3 style={{color:colors[item.key]}}>{item.label}</h3>{!valid(item.point)?<p>موقعیت دستگاه دریافت نشده است.</p>:<><p>{item.key==='origin'?'مبدأ انتخاب‌شده و ذخیره‌شده هنگام درخواست':snapshot?'نمونه ذخیره‌شده دستگاه':item.stale?'آخرین موقعیت قدیمی؛ موقعیت فعلی تأیید نشده':'آخرین موقعیت تازه دستگاه'}</p><p dir="ltr">{item.point.latitude.toFixed(6)}, {item.point.longitude.toFixed(6)}</p><p>زمان نمونه: {stamp(item.point.recordedAt)}</p><a href={`https://www.openstreetmap.org/?mlat=${item.point.latitude}&mlon=${item.point.longitude}#map=17/${item.point.latitude}/${item.point.longitude}`} target="_blank" rel="noreferrer">باز کردن موقعیت روی نقشه</a></>}</article>)}</div>
 <p className="text-sm text-muted">مبدأ درخواست، موقعیت انتخاب‌شده مشتری است و الزاماً GPS دستگاه نیست. موقعیت زنده فقط با دسترسی موقعیت و اینترنت دستگاه به‌روز می‌شود. تا ۵۰ ثبت اخیر نمایش داده می‌شود.</p>
 </>}
 </section>;
}
