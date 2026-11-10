import {reportWorkbook} from './report-workbook.js';
import {periodLabel} from './report-period.js';
const heads=['Catatan valid','Bergerak','Berhenti (0)','Jumlah speed','Rata-rata semua (km/jam)','Rata-rata bergerak (km/jam)','Speed tertinggi (km/jam)','% Bergerak'];
const values=r=>[r.total_count,r.moving_count,r.stopped_count,r.speed_sum,r.average,r.moving_average,r.max_speed,r.moving_ratio===null?null:r.moving_ratio/100];
export async function speedExport(repo,filters,kind){
 const detail=await repo.detail(filters),source=await repo.detail(filters,true),rows=kind==='units'?await repo.units(filters):kind==='monthly'?await repo.monthly(filters):await repo.daily(filters);
 const first=kind==='units'?'Unit':kind==='monthly'?'Bulan':'Tanggal',names={daily:'Rekap harian',monthly:'Rekap bulanan',units:'Rekap unit'};
 const subtitle=`Bengalon Coal Project Â· ${periodLabel(filters)}${filters.unit?' Â· '+filters.unit:''}${filters.search?' Â· Cari: '+filters.search:''}`;
 const note='Speed valid: 0 â‰¤ speed < 80 km/jam. Rata-rata berbobot catatan. Rincian seluruh DT/tanggal terpilih tersedia pada sheet berikutnya.';
 const sheets=[{name:names[kind]||names.daily,title:'DHOCC Â· '+(names[kind]||names.daily),subtitle,note,rows:[[first,...heads,'Catatan sumber','Anomali dikeluarkan','Menunggu verifikasi'],...rows.map(r=>[r.unit||r.month||r.work_date,...values(r),Number(r.source_count||0),Number(r.anomaly_count||0),Number(r.pending_count||0)])],percentColumns:[8],decimalColumns:[4,5,6,7]},
 {name:'Rincian DT per tanggal',title:'Rincian seluruh DT per tanggal',subtitle,note:'Semua pasangan DT/tanggal dalam filter, tanpa pembatasan jumlah baris tabel di website.',rows:[['Tanggal','Unit',...heads,'Catatan sumber','Anomali dikeluarkan','Menunggu verifikasi'],...detail.map(r=>[r.work_date,r.unit,...values(r),Number(r.source_count||0),Number(r.anomaly_count||0),Number(r.pending_count||0)])],percentColumns:[9],decimalColumns:[5,6,7,8]}];
 const flagged=source.filter(r=>r.max_speed>=80);if(flagged.length)sheets.push({name:'Verifikasi sumber',decimalColumns:[3],title:'Rekap sumber yang perlu verifikasi',subtitle,note:'Nilai asli dipertahankan untuk penelusuran. Sheet utama hanya memakai speed valid; arsip tidak lengkap tidak dikoreksi dengan perkiraan.',rows:[['Tanggal','Unit','Catatan sumber','Maksimum sumber (km/jam)','Catatan valid','Anomali dikeluarkan','Menunggu verifikasi'],...flagged.map(r=>{const valid=detail.find(d=>d.unit===r.unit&&d.work_date===r.work_date);return[r.work_date,r.unit,r.total_count,r.max_speed,valid?.total_count||0,Number(valid?.anomaly_count||0),Number(valid?.pending_count||0)];})]});
 return {bytes:reportWorkbook(sheets),csvRows:[[first,...heads],...rows.map(r=>[r.unit||r.month||r.work_date,...values(r)])]};
}
