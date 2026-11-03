export type SourceStatus = 'Ya' | 'Tidak' | 'Belum dicek';
export type District = 'BCP' | 'ACP' | 'KCP' | 'SSCP';
export type Category = 'Production' | 'Support' | 'Belum diklasifikasi';
export type Shift = 'D' | 'N' | 'Belum ditentukan';
export interface LineUpEntry {
  id: string;
  sourceRow?: number;
  site: District;
  date: string;
  unit: string;
  equipment: string;
  operator: string;
  nik: string;
  dh: string;
  mine: string;
  ftw: string;
  sourceStatus: string;
  note: string;
  shift: Shift;
  typeCategory: Category;
  proofFTW: string;
  proofMine: string;
  source: string;
}
export interface Operator { id: string; name: string; nik: string; unit: string; equipment: string; site: District; lastDate: string; }
