import type ExcelJS from "exceljs";

const ink="FF172B4D", muted="FF65748B", blue="FF0057FF";
function sectionColor(label:string){
 if(/Usage Rights/.test(label))return "FF6554A4";
 if(/Boosting/.test(label))return "FF006B76";
 if(/Event Attendance/.test(label))return "FF9B5700";
 if(/TU A|TU B|ITU/.test(label))return "FF52657C";
 if(/creator (cost|currency|rate|quantity)|GP %|Markup %|Internal|IDs|Record ID/i.test(label))return "FF243652";
 return blue;
}

/** Presentation only: preserve cell positions and all pricing formulas. */
export function styleRateWorkbook(book:ExcelJS.Workbook,lang:"en"|"ar"){
 for(const ws of book.worksheets){
  const overview=ws.name==="Overview";
  ws.properties.defaultRowHeight=36;
  ws.properties.tabColor={argb:overview?ink:ws.name.includes("Internal")?"FF243652":blue};
  ws.views=[{state:"frozen",ySplit:1,xSplit:overview?0:1,rightToLeft:lang==="ar",showGridLines:false,zoomScale:90}];
  if(!overview){
   ws.getCell(1,1).value="Creator name";
   ws.columns.forEach((column,index)=>{
    const label=String(ws.getCell(1,index+1).value);
    column.width=index===0?34:/notes|composition|IDs|Record ID/i.test(label)?46:/Offer|Deliverable|Package|platform/i.test(label)?28:/currency/i.test(label)?13:/quantity|Months|days|%/.test(label)?16:22;
    column.numFmt=label.includes("%")?'0.00%;[Red](0.00%);0.00%':/rate|price|cost|Amount|total/i.test(label)&&!/currency|type|ID/i.test(label)?'#,##0.####;[Red](#,##0.####);0':'General';
   });
  }
  ws.eachRow((row,rowNumber)=>{
   let requiredHeight=overview?32:42;
   row.eachCell({includeEmpty:true},(cell,column)=>{
    const header=rowNumber===1;
    const label=String(ws.getCell(1,column).value??"");
    const empty=cell.value==="Not set"||cell.value==="Not applicable"||cell.value==="—";
    const numeric=typeof cell.value==="number"||cell.type===6;
    cell.font={name:"Arial",size:header?(overview?20:11):column===1?12:11,bold:header||column===1,color:{argb:header?"FFFFFFFF":empty?muted:ink},italic:!header&&empty};
    cell.alignment={vertical:"middle",wrapText:true,horizontal:header?(overview?"left":"center"):numeric?"right":/currency/.test(label)?"center":"left",indent:header?0:1,readingOrder:lang==="ar"?"rtl":"ltr"};
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:header?sectionColor(label):column===1?"FFEAF0FC":rowNumber%2===0?"FFF6F8FC":"FFFFFFFF"}};
    cell.border={bottom:{style:"hair",color:{argb:"FFDDE5EF"}},right:{style:"hair",color:{argb:"FFE6ECF4"}}};
    if(!header){const text=typeof cell.value==="string"?cell.value:"";const width=ws.getColumn(column).width??22;const wrapped=text.split("\n").reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/Math.max(10,width-3))),0);requiredHeight=Math.max(requiredHeight,wrapped*16+14);}
   });
   row.height=rowNumber===1?(overview?48:72):Math.min(240,requiredHeight);
  });
  if(!overview)ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,ws.rowCount),column:ws.columnCount}};
  ws.pageSetup={orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:"1:1",printTitlesColumn:overview?undefined:"A:A",margins:{left:0.25,right:0.25,top:0.5,bottom:0.5,header:0.2,footer:0.2}};
  ws.headerFooter.oddHeader="&L&\"Arial,Bold\"THINKWAY&R"+ws.name;
  ws.headerFooter.oddFooter="&LReference prices · No FX conversion&RPage &P of &N";
 }
}

