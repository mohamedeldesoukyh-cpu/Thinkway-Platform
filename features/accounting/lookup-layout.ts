import type {CSSProperties} from 'react';
export const lookupDialog:CSSProperties={minHeight:0,width:'min(740px, calc(100vw - 32px))',maxWidth:740,maxHeight:'85vh',display:'flex',flexDirection:'column',gap:14,padding:22,fontSize:13};
export const lookupScroll:CSSProperties={maxHeight:'52vh',minHeight:100,overflow:'auto',border:'1px solid #d8e3e9',borderRadius:6};
export const lookupHead:CSSProperties={position:'sticky',top:0,zIndex:1,background:'#edf4f7'};
export const lookupCode:CSSProperties={width:'14ch',whiteSpace:'nowrap',padding:'9px 12px',fontVariantNumeric:'tabular-nums'};
export const lookupName:CSSProperties={padding:'9px 12px',overflowWrap:'anywhere'};
export const lookupInput:CSSProperties={width:'100%',height:34,minHeight:34,border:'1px solid #bdced7',borderRadius:5,padding:'6px 10px',fontSize:13,background:'#fff'};
