import registry from '../data/dt-units.json' with { type: 'json' };
import { audit } from './db.js';
import { choice, text, HttpError } from './validation.js';

export const EQUIPMENT_KINDS = ['Excavator','Dump Truck','Grader','Track Dozer'];
const unique = values => [...new Map(values.filter(Boolean).map(value=>value.trim().replace(/\s+/g,' ')).filter(value=>value&&value!=='-').map(value=>[value.toLocaleLowerCase('id-ID'),value])).values()].sort((a,b)=>a.localeCompare(b,'id-ID',{numeric:true}));
const optionKey=value=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');
export function suggestedKind(unit='') {
  return /^DT\d/i.test(unit)?'Dump Truck':/^EX\d/i.test(unit)?'Excavator':/^GR\d/i.test(unit)?'Grader':/^TD\d/i.test(unit)?'Track Dozer':'';
}
export async function equipmentOptions(db) {
  const stored=(await db.query('SELECT category,value,is_removed FROM fleetsync.equipment_options')).rows;
  const existing=(await db.query('SELECT unit,equipment,equipment_kind FROM fleetsync.lineups UNION SELECT unit,equipment,equipment_kind FROM fleetsync.operators')).rows;
  const visible=(category,values)=>{const removed=new Set(stored.filter(r=>r.category===category&&r.is_removed).map(r=>optionKey(r.value)));return unique(values).filter(value=>!removed.has(optionKey(value)));};
  return {
    unit:unique([...registry.units,...existing.map(r=>r.unit),...stored.filter(r=>r.category==='unit').map(r=>r.value)]),
    kind:visible('kind',[...EQUIPMENT_KINDS,...existing.map(r=>r.equipment_kind),...stored.filter(r=>r.category==='kind').map(r=>r.value)]),
    model:visible('model',['CAT 777',...existing.map(r=>r.equipment),...stored.filter(r=>r.category==='model').map(r=>r.value)]),
  };
}
export async function rememberEquipment(db,row) {
  for(const [category,value] of [['unit',row.unit],['kind',row.equipment_kind],['model',row.equipment]]) if(value) await db.query('INSERT INTO fleetsync.equipment_options(category,value) VALUES($1,$2) ON CONFLICT DO NOTHING',[category,value]);
}
export async function addEquipmentOption(db,actor,input) {
  const category=choice(input,'category',['kind','model']),value=text(input,'value',100,true).replace(/\s+/g,' ');
  return db.transaction(async tx=>{
    const result=await tx.query('INSERT INTO fleetsync.equipment_options(category,value) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING value',[category,value]);
    if(result.rows.length) await audit(tx,actor,'create','equipment-option',category,{value});
    else {const restored=await tx.query('UPDATE fleetsync.equipment_options SET is_removed=false WHERE category=$1 AND lower(value)=lower($2) AND is_removed RETURNING value',[category,value]);if(restored.rows.length)await audit(tx,actor,'update','equipment-option',category,{value:restored.rows[0].value,restored:true});}
    return (await tx.query('SELECT value FROM fleetsync.equipment_options WHERE category=$1 AND lower(value)=lower($2)',[category,value])).rows[0].value;
  });
}
export async function removeEquipmentOption(db,actor,input){
  const category=choice(input,'category',['kind','model']),value=text(input,'value',100,true).replace(/\s+/g,' ');
  return db.transaction(async tx=>{
    const prior=(await tx.query('SELECT value,is_removed FROM fleetsync.equipment_options WHERE category=$1 AND lower(value)=lower($2)',[category,value])).rows[0];
    if(prior?.is_removed)return {value:prior.value,removed:false};
    const catalog=await equipmentOptions(tx),match=catalog[category].find(item=>optionKey(item)===optionKey(value));
    if(!match)throw new HttpError(404,'Pilihan alat tidak ditemukan. Muat ulang formulir.');
    const result=await tx.query('INSERT INTO fleetsync.equipment_options(category,value,is_removed) VALUES($1,$2,true) ON CONFLICT (category,lower(value)) DO UPDATE SET is_removed=true WHERE NOT fleetsync.equipment_options.is_removed RETURNING value',[category,match]);
    if(result.rows.length)await audit(tx,actor,'delete','equipment-option',category,{value:match,scope:'catalog-only'});
    return {value:match,removed:result.rows.length>0};
  });
}
