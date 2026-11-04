import { randomBytes } from 'node:crypto';
import { audit, one } from './db.js';
import { HttpError } from './validation.js';

const fields = ['site','work_date','shift','type_category','unit','equipment','operator_name','nik','dh','mine','ftw','source_status','note','proof_ftw','proof_mine'];
export class Repository {
  constructor(db, actor) { this.db = db; this.actor = actor; }
  async lineups(filters = {}) {
    const terms = [], values = [];
    for (const key of ['site','work_date','shift','type_category']) if (filters[key] && filters[key] !== 'All') { values.push(filters[key]); terms.push(`${key}=$${values.length}`); }
    if (filters.search) { values.push(`%${filters.search}%`); terms.push(`concat_ws(' ',unit,equipment,operator_name,nik,note,work_date::text) ILIKE $${values.length}`); }
    return (await this.db.query(`SELECT * FROM fleetsync.lineups ${terms.length ? 'WHERE '+terms.join(' AND ') : ''} ORDER BY work_date,unit,id`, values)).rows;
  }
  async lineup(id) { return await one(this.db, 'SELECT * FROM fleetsync.lineups WHERE id=$1', [id]) || Promise.reject(new HttpError(404, 'Data Line Up tidak ditemukan.')); }
  async operators(filters = {}) { return (await this.db.query("SELECT * FROM fleetsync.operators WHERE site=$1 AND concat_ws(' ',name,nik,unit,equipment) ILIKE $2 ORDER BY name,id", [filters.site || 'BCP', `%${filters.search || ''}%`])).rows; }
  async operator(id) { return await one(this.db, 'SELECT * FROM fleetsync.operators WHERE id=$1', [id]) || Promise.reject(new HttpError(404, 'Master Operator tidak ditemukan.')); }
  async syncOperator(db, row) {
    if (!row.nik) return;
    await db.query(`INSERT INTO fleetsync.operators(site,nik,name,unit,equipment,last_date) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(site,nik) DO UPDATE SET
      name=CASE WHEN fleetsync.operators.last_date IS NULL OR fleetsync.operators.last_date<=excluded.last_date THEN excluded.name ELSE fleetsync.operators.name END,
      unit=CASE WHEN fleetsync.operators.last_date IS NULL OR fleetsync.operators.last_date<=excluded.last_date THEN excluded.unit ELSE fleetsync.operators.unit END,
      equipment=CASE WHEN fleetsync.operators.last_date IS NULL OR fleetsync.operators.last_date<=excluded.last_date THEN excluded.equipment ELSE fleetsync.operators.equipment END,
      last_date=greatest(fleetsync.operators.last_date,excluded.last_date),version=fleetsync.operators.version+1,updated_at=now()`, [row.site,row.nik,row.operator_name,row.unit,row.equipment,row.work_date]);
  }
  async insert(db, row, id = `js-${randomBytes(12).toString('hex')}`, { skipDuplicate = false } = {}) {
    const cols = [...fields,'source','source_row']; row = { proof_ftw:'',proof_mine:'',source:'Input FleetSync',source_row:null,...row };
    const result = await db.query(`INSERT INTO fleetsync.lineups(id,${cols.join(',')}) VALUES(${Array.from({length:cols.length+1},(_,i)=>`$${i+1}`).join(',')}) ${skipDuplicate ? 'ON CONFLICT DO NOTHING' : ''} RETURNING id`, [id,...cols.map(k=>row[k])]);
    if (!result.rows.length) return null;
    await this.syncOperator(db,row); await audit(db,this.actor,'create','lineup',id,{unit:row.unit,date:row.work_date}); return id;
  }
  async update(db, id, version, row) {
    const result = await db.query(`UPDATE fleetsync.lineups SET ${fields.map((k,i)=>`${k}=$${i+1}`).join(',')},version=version+1,updated_at=now() WHERE id=$${fields.length+1} AND version=$${fields.length+2} RETURNING id`, [...fields.map(k=>row[k]),id,version]);
    if (!result.rows.length) throw new HttpError(409,'Data sudah berubah atau dihapus pengguna lain. Buka ulang formulir sebelum menyimpan.');
    await this.syncOperator(db,row); await audit(db,this.actor,'update','lineup',id,{unit:row.unit,version:version+1});
  }
  async delete(db, id, version) {
    if (!(await db.query('DELETE FROM fleetsync.lineups WHERE id=$1 AND version=$2 RETURNING id',[id,version])).rows.length) throw new HttpError(409,'Data sudah berubah. Muat ulang sebelum menghapus.');
    await audit(db,this.actor,'delete','lineup',id);
  }
  async saveOperator(db,row,id,version) {
    const keys=['site','name','nik','unit','equipment','last_date'], values=keys.map(k=>row[k]);
    if (id) {
      if (!(await db.query(`UPDATE fleetsync.operators SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},version=version+1,updated_at=now() WHERE id=$7 AND version=$8 RETURNING id`,[...values,id,version])).rows.length) throw new HttpError(409,'Profil sudah berubah. Muat ulang formulir.');
    } else id=(await one(db,`INSERT INTO fleetsync.operators(${keys.join(',')}) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,values)).id;
    await audit(db,this.actor,'save','operator',id,{nik:row.nik});return id;
  }
  async deleteOperator(db,id,version) {
    const row=await one(db,'SELECT * FROM fleetsync.operators WHERE id=$1 FOR UPDATE',[id]);
    if (!row) throw new HttpError(404,'Master Operator tidak ditemukan.');
    if (Number((await one(db,'SELECT count(*) AS n FROM fleetsync.lineups WHERE site=$1 AND nik=$2',[row.site,row.nik])).n)) throw new HttpError(409,'Operator masih memiliki riwayat Line Up dan tidak dapat dihapus.');
    if (!(await db.query('DELETE FROM fleetsync.operators WHERE id=$1 AND version=$2 RETURNING id',[id,version])).rows.length) throw new HttpError(409,'Profil sudah berubah. Muat ulang formulir.');
    await audit(db,this.actor,'delete','operator',id);
  }
  async auditRows() { return (await this.db.query('SELECT a.*,u.name AS user_name FROM fleetsync.audit_logs a LEFT JOIN fleetsync.users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200')).rows; }
}
