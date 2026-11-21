"use client";
import { useState } from "react";
export function ModuleSignOut() {
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState(false);
 return <><button className="tw-ac-button" disabled={busy} onClick={async()=>{
  setBusy(true);setError(false);
  try {const response=await fetch('/api/modules',{method:'POST'});if(!response.ok)throw new Error('Sign out failed');window.location.assign('/login');}
  catch {setBusy(false);setError(true);}
 }}>{busy?'Signing out…':'Sign out'}</button>{error && <span role="alert">Could not sign out. Please retry.</span>}</>;
}
