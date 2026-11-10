import {one} from './db.js';
export function driveReference(url){try{const u=new URL(url);if(u.hostname!=='drive.google.com')return '';return u.pathname.match(/\/(?:folders|d)\/([\w-]+)/)?.[1]||u.searchParams.get('id')||'';}catch{return '';}}
export async function occPhotos(db,asset){const setting=await one(db,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='occ_photos_v1'");let manifest={};try{manifest=JSON.parse(setting?.setting_value||'{}');}catch{}return manifest[driveReference(asset.photo_url)]||[];}
