'use client';
import {useState} from 'react';
import {useAuth} from './AuthProvider';
export default function AccountDeletion({user,busy,onDelete}){
 const {user:actor}=useAuth(),[phone,setPhone]=useState(''),[reason,setReason]=useState('');
 if(actor?.role!=='admin')return null;
 return <details className="superapp-form"><summary className="text-danger">حذف دائمی حساب — فقط مدیر</summary><form className="superapp-form" onSubmit={e=>{e.preventDefault();if(!busy&&phone.trim()===user.phone)onDelete({confirmation:'DELETE',phone:phone.trim(),reason});}}><p>اطلاعات هویتی، مدارک و دسترسی حساب حذف می‌شوند و بازیابی حساب ممکن نیست. سوابق مالی و درخواست‌های گذشته با شناسهٔ ناشناس باقی می‌مانند. حساب دارای مأموریت فعال یا تسویهٔ باز، ابتدا باید تعیین تکلیف شود.</p><label>شماره همراه حساب برای تأیید حذف<input required dir="ltr" value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy} autoComplete="off"/></label><label>علت حذف حساب<textarea required minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label><button className="btn btn-danger" disabled={busy||phone.trim()!==user.phone||reason.trim().length<3}>حذف دائمی حساب</button></form></details>;
}
