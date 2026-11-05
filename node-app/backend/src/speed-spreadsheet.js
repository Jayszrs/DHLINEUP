import {readSpreadsheetTables} from './spreadsheet.js';
import {HttpError} from './validation.js';

export const GPS_HEADERS=['Device ID','Device Name','Fleet Name','Speed','Altitude','Creation Time','Location','Precision','Direct','Satellites','IO Status','Emergency','ACC State'];
const normalize=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const names={unit:['devicename','unit','unitdt','nomordt','kodealat','vehicle','vehiclename','vehicleno','vehiclenumber','plateno'],time:['creationtime','gpstime','datetime','timestamp','waktu','tanggaldanwaktu'],speed:['speed','speedkmh','speedkmjam','gpsspeed','kecepatan'],day:['tanggal','date','workdate','tanggalkegiatan'],total:['catatan','totalcatatan','sampelgps','totalcount','jumlahcatatan'],moving:['bergerak','moving','movingcount'],sum:['jumlahspeed','speed_sum','speedsum','totalspeed'],max:['speedtertinggi','maxspeed','maximumspeed','maksimum']};
const lookup=Object.fromEntries(Object.entries(names).flatMap(([key,list])=>list.map(v=>[normalize(v),key])));
export function mdvrUnit(value){const match=String(value??'').toUpperCase().match(/(?:^|[^A-Z])(?:DH)?DT[\s_-]*(\d{1,8})(?![A-Z0-9])/);return match?'DT'+match[1]:'';}
function number(value,integer=false){let raw=String(value??'').trim().replace(/\s*(?:km\/?h|km\/?jam|kph)$/i,'').trim();if(!raw)throw new Error('angka kosong');if(raw.includes(',')&&raw.includes('.'))raw=raw.lastIndexOf(',')>raw.lastIndexOf('.')?raw.replaceAll('.','').replace(',','.'):raw.replaceAll(',','');else if(raw.includes(','))raw=integer&&/^\d{1,3}(,\d{3})+$/.test(raw)?raw.replaceAll(',',''):raw.replace(',','.');else if(integer&&/^\d{1,3}(\.\d{3})+$/.test(raw))raw=raw.replaceAll('.','');if(!/^\d+(\.\d{1,8})?$/.test(raw))throw new Error('format angka tidak valid');const n=Number(raw);if(!Number.isFinite(n)||n<0||(integer&&!Number.isSafeInteger(n)))throw new Error('angka tidak valid');return n;}
function timestamp(value,date1904,dayOnly=false){let raw=String(value??'').trim();if(/^\d+(\.\d+)?$/.test(raw)){const serial=Number(raw);if(serial<1||serial>73050)throw new Error('tanggal Excel tidak valid');raw=new Date(Date.parse(date1904?'1904-01-01':'1899-12-30')+Math.round(serial*86400)*1000).toISOString().replace('T',' ').replace('.000Z','');}
 raw=raw.replace(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?=\s|$)/,(_m,d,m,y)=>`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`).replace('T',' ');
 const match=raw.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?)?$/);if(!match||(!dayOnly&&!match[2]))throw new Error('tanggal/jam tidak valid');const iso=match[1];if(iso<'1990-01-01'||iso>'2100-12-31'||new Date(iso+'T00:00:00Z').toISOString().slice(0,10)!==iso||Number(match[2]||0)>23||Number(match[3]||0)>59||Number(match[4]||0)>59)throw new Error('tanggal/jam tidak valid');const fraction=(match[5]||'').replace(/0+$/,'').replace(/\.$/,'');if(match[6]){const milliseconds=Date.parse(`${iso}T${match[2]}:${match[3]}:${match[4]||'00'}${match[6]}`);if(!Number.isFinite(milliseconds))throw new Error('zona waktu tidak valid');const local=new Date(milliseconds+7*3600000).toISOString().slice(0,19).replace('T',' ')+fraction;return dayOnly?local.slice(0,10):local;}return dayOnly?iso:`${iso} ${match[2]}:${match[3]}:${match[4]||'00'}${fraction}`;
}
export function readSpeedSpreadsheet(bytes,extension,{unit='',filename=''}={}){
 const book=readSpreadsheetTables(bytes,extension),fallback=unit?mdvrUnit(unit):mdvrUnit(filename),groups=new Map(),seen=new Map();let duplicates=0,recognized=0,kind='',readings=0;
 if(unit&&!fallback)throw new HttpError(422,'Nomor DT cadangan harus berupa DT diikuti angka.');
 for(const sheet of book.sheets){let mapping,headerIndex=-1,mode;for(const [i,row] of sheet.rows.slice(0,30).entries()){const candidate={};row.forEach((v,index)=>{const key=lookup[normalize(v)];if(key&&candidate[key]===undefined)candidate[key]=index;});if(candidate.time!==undefined&&candidate.speed!==undefined){mapping=candidate;mode='gps';headerIndex=i;break;}if(['day','total','moving','sum','max'].every(k=>candidate[k]!==undefined)){mapping=candidate;mode='recap';headerIndex=i;break;}}
  if(!mapping)continue;if(kind&&kind!==mode)throw new HttpError(422,'Pisahkan file GPS MDVR dan rekap harian menjadi impor terpisah.');kind=mode;recognized++;const headers=sheet.rows[headerIndex].map(v=>String(v??'').trim()),sheetUnit=mdvrUnit(sheet.name)||fallback;
  if(headers.length>100)throw new HttpError(422,'Maksimal 100 kolom per impor.');
  const extra=headers.map((v,i)=>({v,i})).filter(x=>x.v&&!GPS_HEADERS.some(h=>normalize(h)===normalize(x.v))&&!['speednumerickmjam','tanggalgps'].includes(normalize(x.v))&&![mapping.unit,mapping.time,mapping.speed].includes(x.i));
  const gpsHeaders=[...GPS_HEADERS,...extra.map(x=>x.v),'Speed Numeric (km/jam)','Tanggal GPS'];
  for(const [offset,row] of sheet.rows.slice(headerIndex+1).entries()){
   const keys=mode==='gps'?['unit','time','speed']:['unit','day','total','moving','sum','max'];if(!keys.some(k=>mapping[k]!==undefined&&String(row[mapping[k]]??'').trim()))continue;
   if(normalize(row[mapping.time??mapping.day])===normalize(headers[mapping.time??mapping.day]))continue;
   try{
    const rawUnit=mapping.unit!==undefined?String(row[mapping.unit]??'').trim():'';const dt=rawUnit?mdvrUnit(rawUnit):sheetUnit;if(!dt)throw new Error('nomor DT tidak ditemukan; isi Nomor DT cadangan jika file hanya memuat satu unit');
    const time=timestamp(row[mapping.time??mapping.day],book.date1904,mode==='recap'),day=time.slice(0,10),key=dt+':'+day;let group=groups.get(key);if(!group){group={unit:dt,work_date:day,total_count:0,moving_count:0,speed_sum:0,max_speed:0,headers:gpsHeaders,rows:[]};groups.set(key,group);}
    if(groups.size>5000)throw new Error('maksimal 5.000 pasangan DT/tanggal per impor');
    if(mode==='gps'){
     const speed=number(row[mapping.speed]);if(speed>500)throw new Error('speed harus antara 0 dan 500 km/jam');
     const canonical=GPS_HEADERS.map(h=>{const index=headers.findIndex(v=>normalize(v)===normalize(h));return index<0?'':String(row[index]??'');});canonical[0]||=dt;canonical[1]=dt;canonical[2]||='DT DARMA HENWA';canonical[3]=String(speed)+' km/h';canonical[5]=time;
     const cells=[...canonical,...extra.map(x=>String(row[x.i]??'')),String(speed),day];
     const identity=dt+'|'+canonical[0]+'|'+time,signature=JSON.stringify(cells),old=seen.get(identity);if(old){if(old!==signature)throw new Error('pembacaan dengan perangkat dan jam yang sama memiliki nilai berbeda');duplicates++;continue;}seen.set(identity,signature);
     if(++readings>200000)throw new Error('maksimal 200.000 pembacaan per impor');
     if(JSON.stringify(group.headers)!==JSON.stringify(gpsHeaders))throw new Error('kolom GPS untuk DT/tanggal yang sama berbeda antarsheet; impor terpisah');group.rows.push(cells);group.total_count++;if(speed>0)group.moving_count++;group.speed_sum+=speed;group.max_speed=Math.max(group.max_speed,speed);
    }else{
     const values={total_count:number(row[mapping.total],true),moving_count:number(row[mapping.moving],true),speed_sum:number(row[mapping.sum]),max_speed:number(row[mapping.max])};if(values.total_count<1||values.total_count>100000000||values.moving_count>values.total_count||values.max_speed>500||values.speed_sum>values.max_speed*values.moving_count+.0001||(values.moving_count>0&&(values.speed_sum<=0||values.speed_sum+.0001<values.max_speed))||(values.moving_count===0&&(values.speed_sum!==0||values.max_speed!==0)))throw new Error('jumlah catatan/bergerak/jumlah speed/maksimum tidak sesuai');
     const signature=JSON.stringify(values),old=seen.get(key);if(old){if(old!==signature)throw new Error('rekap DT/tanggal yang sama memiliki nilai berbeda');duplicates++;continue;}seen.set(key,signature);Object.assign(group,values);readings+=values.total_count;
    }
   }catch(error){throw new HttpError(422,`Sheet ${sheet.name}, baris ${headerIndex+offset+2}: ${error.message}.`);}
  }
 }
 const daily=[...groups.values()].filter(r=>r.total_count>0).map(r=>({...r,speed_sum:Number(r.speed_sum.toFixed(4))})).sort((a,b)=>a.unit.localeCompare(b.unit)||a.work_date.localeCompare(b.work_date));if(!recognized||!daily.length)throw new HttpError(422,'Kolom MDVR belum dikenali. Gunakan Device Name, Speed, Creation Time; atau Unit, Tanggal, Catatan, Bergerak, Jumlah Speed, Speed Tertinggi.');
 return{kind,daily,duplicates,readings,rows:[]};
}
