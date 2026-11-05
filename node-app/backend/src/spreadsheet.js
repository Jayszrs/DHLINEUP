import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { parse } from 'csv-parse/sync';
import path from 'node:path';
import { HttpError, lineup } from './validation.js';

export const HEADERS = ['Tanggal','Site','Shift','Type','Kode Alat','Tipe Alat','Nama Operator','NIK Operator','DH Line Up','Mine Dispatch','FTW Terisi','Status Sumber','Catatan','Jenis Alat'];
const FIELDS = ['work_date','site','shift','type_category','unit','equipment','operator_name','nik','dh','mine','ftw','source_status','note','equipment_kind'];
const normalize = s => String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases = { work_date:['Tanggal','Date','work_date'],site:['Site','District'],shift:['Shift'],type_category:['Type','Kategori','type_category'],unit:['Kode Alat','Unit','kode_alat'],equipment:['Jenis Alat','Tipe Alat','equipment'],equipment_kind:['Kategori Alat','equipment_kind'],operator_name:['Nama Operator','Operator','operator_name'],nik:['NIK Operator','NIK'],dh:['DH Line Up','Terdata di DH Line Up','dh_line_up'],mine:['Mine Dispatch','Terdata di Mine Dispatch?','mine_dispatch'],ftw:['FTW Terisi','FTW Terisi?','ftw_terisi'],source_status:['Status Sumber','Status Verifikasi'],note:['Catatan','Note'] };
const lookup = Object.fromEntries(Object.entries(aliases).flatMap(([k,list])=>list.map(v=>[normalize(v),k])));
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const xml = new XMLParser({ ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,trimValues:false,removeNSPrefix:true,processEntities:true });
function parseXml(bytes) {
  const content=strFromU8(bytes || new Uint8Array());
  if (/<!DOCTYPE|<!ENTITY/i.test(content)) throw new HttpError(422,'Deklarasi entity XML tidak diizinkan.');
  return xml.parse(content);
}
function nodeText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if ('t' in value) return nodeText(value.t);
  if ('#text' in value) return nodeText(value['#text']);
  return array(value.r).map(nodeText).join('');
}
function columnIndex(reference) { let index=0; for(const c of reference.replace(/\d/g,'')) index=index*26+c.charCodeAt(0)-64; return index-1; }
function document(buffer,extension,{allSheets=false,maxRows=5030}={}) {
  if (buffer.length>10*1024*1024) throw new HttpError(422,'Maksimal ukuran file 10 MB.');
  if (extension==='csv') {
    let content;
    try { content=new TextDecoder(buffer[0]===0xff&&buffer[1]===0xfe?'utf-16le':buffer[0]===0xfe&&buffer[1]===0xff?'utf-16be':'utf-8',{fatal:true}).decode(buffer); }
    catch { content=new TextDecoder('windows-1252').decode(buffer); }
    content=content.replace(/^\uFEFF/,'');
    const first=allSheets?content.split(/\r?\n/,30).join('\n'):content.split(/\r?\n/,1)[0],delimiter=[',',';','\t'].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
    const rows=parse(content,{delimiter,relax_column_count:true,skip_empty_lines:false,max_record_size:1000000,to:maxRows+1});
    if(rows.length>maxRows)throw new HttpError(422,'Jumlah baris file melebihi batas impor.');
    return {rows,sheets:[{name:'CSV',rows}],date1904:false};
  }
  if (extension!=='xlsx') throw new HttpError(422,'Format yang didukung: XLSX dan CSV. Simpan ulang file XLS lama menjadi XLSX.');
  let total=0,entries=0;
  const files=unzipSync(buffer,{filter(file) {
    if (++entries>5000 || file.originalSize>25*1024*1024 || file.name.split('/').includes('..')) throw new HttpError(422,'Arsip Excel melebihi batas aman.');
    if (!/^(xl\/.*\.xml|xl\/_rels\/workbook\.xml\.rels)$/.test(file.name)) return false;
    total+=file.originalSize;
    if(total>40*1024*1024) throw new HttpError(422,'Isi Excel terlalu besar.');
    return true;
  }});
  if (!files['xl/workbook.xml']) throw new HttpError(422,'Struktur XLSX tidak lengkap.');
  const workbook=parseXml(files['xl/workbook.xml']).workbook;
  const relationships=array(parseXml(files['xl/_rels/workbook.xml.rels']).Relationships?.Relationship);
  const shared=files['xl/sharedStrings.xml']?array(parseXml(files['xl/sharedStrings.xml']).sst?.si).map(nodeText):[];
  const selected=allSheets?array(workbook.sheets?.sheet):array(workbook.sheets?.sheet).slice(0,1),sheets=[];let rowCount=0;
  if(selected.length>200)throw new HttpError(422,'Maksimal 200 sheet per impor.');
  for(const sheet of selected){
  const rel=relationships.find(r=>r['@_Id']===sheet?.['@_id']);
  if (!rel || rel['@_TargetMode']==='External') throw new HttpError(422,'Worksheet Excel tidak valid.');
  const sheetPath=path.posix.normalize('xl/'+rel['@_Target'].replace(/^\/?xl\//,''));
  if (!sheetPath.startsWith('xl/worksheets/') || !files[sheetPath]) throw new HttpError(422,'Worksheet tidak tersedia.');
  const rows=[];
  for(const row of array(parseXml(files[sheetPath]).worksheet?.sheetData?.row)) {
    if(++rowCount>maxRows) throw new HttpError(422,'Jumlah baris file melebihi batas impor.');
    const cells=[];
    for(const cell of array(row.c)) {
      const index=columnIndex(String(cell['@_r'] || 'A1'));
      if(index<0 || index>=100) throw new HttpError(422,'Maksimal 100 kolom per impor.');
      cells[index]=cell['@_t']==='s'?(shared[Number(cell.v)]??''):cell['@_t']==='inlineStr'?nodeText(cell.is):String(cell.v??'');
    }
    rows.push(cells);
  }
  sheets.push({name:String(sheet['@_name']||''),rows});
  }
  return {rows:sheets[0]?.rows||[],sheets,date1904:['1','true'].includes(String(workbook.workbookPr?.['@_date1904']))};
}
export function readSpreadsheetTables(buffer,extension) {
  try{return document(buffer,extension,{allSheets:true,maxRows:200030});}
  catch(error){if(error instanceof HttpError)throw error;throw new HttpError(422,'File tidak dapat dibaca. Gunakan XLSX atau CSV yang valid.');}
}
export function readSpreadsheet(buffer,extension) {
  try {
    const data=document(buffer,extension);let mapping=null;const output=[];
    for(const [i,cells] of data.rows.entries()) {
      if(cells.length>100) throw new HttpError(422,'Maksimal 100 kolom per impor.');
      if(!mapping) {
        const hasModel=cells.some(v=>normalize(v)==='tipealat');
        const candidate=cells.map(v=>hasModel&&normalize(v)==='jenisalat'?'equipment_kind':lookup[normalize(v)]);
        if(candidate.includes('work_date')&&candidate.includes('unit')) mapping=candidate;
        else if(i>=29) break;
        continue;
      }
      if(!cells.some(v=>String(v??'').trim())) continue;
      if(output.length>=5000) throw new HttpError(422,'Maksimal 5.000 baris data per impor.');
      const row={};mapping.forEach((field,index)=>{if(field) row[field]=String(cells[index]??'').trim();});
      for(const [k,v] of Object.entries({site:'BCP',shift:'Belum ditentukan',type_category:'Belum diklasifikasi'})) row[k]||=v;
      for(const k of ['dh','mine','ftw']) {
        const value=(row[k]||'').toLowerCase();
        if(!['ya','yes','tidak','no','','belum dicek'].includes(value)) throw new HttpError(422,`Baris ${i+1}: status ${k} tidak valid.`);
        row[k]=['ya','yes'].includes(value)?'Ya':['tidak','no'].includes(value)?'Tidak':'Belum dicek';
      }
      if(/^\d+(\.\d+)?$/.test(row.work_date)&&Number(row.work_date)>0&&Number(row.work_date)<3000000) row.work_date=new Date(Date.parse(data.date1904?'1904-01-01':'1899-12-30')+Math.floor(Number(row.work_date))*86400000).toISOString().slice(0,10);
      else row.work_date=row.work_date?.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/,'$3-$2-$1');
      try { output.push({...lineup(row),source:'Impor XLSX/CSV'}); } catch(error) { throw new HttpError(422,`Baris ${i+1}: ${error.message}`); }
    }
    if(!output.length) throw new HttpError(422,'Tidak ada data valid. Gunakan template dengan kolom Tanggal dan Kode Alat.');
    return output;
  } catch(error) { if(error instanceof HttpError) throw error; throw new HttpError(422,'File spreadsheet tidak dapat dibaca. Periksa format XLSX/CSV.'); }
}
export function exportRows(rows,kind='lineup') {
  const master=kind==='master',fields=master?['site','name','nik','unit','equipment','last_date','equipment_kind']:FIELDS;
  return [master?['Site','Nama Operator','NIK','Unit Terakhir','Tipe Alat','Tanggal Terakhir','Jenis Alat']:HEADERS,...rows.map(row=>fields.map(k=>String(row[k]??'')))];
}
const escapeXml=value=>String(value).replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function col(i) { let value='';for(i++;i;i=Math.floor((i-1)/26)) value=String.fromCharCode(65+(i-1)%26)+value;return value; }
export function xlsx(rows) {
  const parts={
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Line Up" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><sheetData>'+rows.map((row,i)=>`<row r="${i+1}">`+row.map((v,j)=>`<c r="${col(j)}${i+1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`).join('')+'</row>').join('')+`</sheetData><autoFilter ref="A1:${col(rows[0].length-1)}${rows.length}"/></worksheet>`,
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,strToU8('<?xml version="1.0" encoding="UTF-8"?>'+v)]))));
}
export function csv(rows) { return '\uFEFF'+rows.map(row=>row.map(v=>'"'+(/^[\s]*[=+@-]/.test(String(v))?"'":'')+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n'; }
