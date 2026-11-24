import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type RecognitionConstructor=new()=>Recognition;
export function FinanceVoiceInput({disabled,onText}:{disabled:boolean;onText:(text:string)=>void}){
 const [language,setLanguage]=useState("ar-EG"),[listening,setListening]=useState(false),[status,setStatus]=useState("");
 const active=useRef<Recognition|null>(null);
 useEffect(()=>()=>{if(active.current){active.current.onresult=null;active.current.onend=null;active.current.onerror=null;active.current.abort();}},[]);
 function start(){
  const browser=window as unknown as {SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};
  const Constructor=browser.SpeechRecognition??browser.webkitSpeechRecognition;
  if(!Constructor){setStatus("Voice input is unavailable in this browser. Type your request instead.");return;}
  if(active.current)return;
  const recognition=new Constructor();active.current=recognition;recognition.lang=language;recognition.continuous=false;recognition.interimResults=false;
  recognition.onresult=event=>{const text=event.results[0]?.[0]?.transcript?.trim();if(text){onText(text);setStatus("Review the recognized text, then press Ask Finance. / راجع النص ثم أرسل الطلب.");}};
  recognition.onerror=event=>setStatus(event.error==="not-allowed"?"Microphone permission was not granted. You can type instead.":"Voice recognition failed. Please retry or type your request.");
  recognition.onend=()=>{active.current=null;setListening(false);};
  try{setListening(true);setStatus("Listening… / جارٍ الاستماع");recognition.start();}catch{active.current=null;setListening(false);setStatus("Unable to start voice recognition.");}
 }
 return <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><label className="text-sm">Voice language <select className="min-h-11 rounded border bg-background px-2" disabled={disabled||listening} value={language} onChange={e=>setLanguage(e.target.value)}><option value="ar-EG">العربية</option><option value="en-US">English</option></select></label><Button type="button" variant="outline" disabled={disabled&&!listening} onClick={()=>listening?active.current?.stop():start()}>{listening?"Stop microphone":"Dictate request"}</Button></div><p className="text-xs text-muted-foreground">Starts only when clicked. Your browser may process speech using its online recognition service. Dictation fills the request; it never sends or executes it automatically.</p>{status&&<p role="status" className="text-sm">{status}</p>}</div>;
}
