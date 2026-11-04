import registry from '../data/dt-units.json' with { type: 'json' };
import { audit } from './db.js';
import { choice, text } from './validation.js';

export const EQUIPMENT_KINDS = ['Excavator','Dump Truck','Grader','Track Dozer'];
const unique = values => [...new Map(values.filter(Boolean).map(value=>value.trim().replace(/\s+/g,' ')).filter(value=>value&&value!=='-').map(value=>[value.toLocaleLowerCase('id-ID'),value])).values()].sort((a,b)=>a.localeCompare(b,'id-ID',{numeric:true}));
export function suggestedKind(unit='') {
  return /^DT\d/i.test(unit)?'Dump Truck':/^EX\d/i.test(unit)?'Excavator':/^GR\d/i.test(unit)?'Grader':/^TD\d/i.test(unit)?'Track Dozer':'';
}
export async function equipmentOptions(db) {
  const stored=(await db.query('SELECT category,value FROM fleetsync.equipment_options')).rows;
  const existing=(await db.query('SELECT unit,equipment,equipment_kind FROM fleetsync.lineups UNION SELECT unit,equipment,equipment_kind FROM fleetsync.operators')).rows;
  return {
    unit:unique([...registry.units,...existing.map(r=>r.unit),...stored.filter(r=>r.category==='unit').map(r=>r.value)]),
    kind:unique([...EQUIPMENT_KINDS,...existing.map(r=>r.equipment_kind),...stored.filter(r=>r.category==='kind').map(r=>r.value)]),
    model:unique(['CAT 777',...existing.map(r=>r.equipment),...stored.filter(r=>r.category==='model').map(r=>r.value)]),
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
    return (await tx.query('SELECT value FROM fleetsync.equipment_options WHERE category=$1 AND lower(value)=lower($2)',[category,value])).rows[0].value;
  });
}
