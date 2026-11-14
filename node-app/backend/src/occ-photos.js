import {one} from './db.js';
export function driveReference(url){try{const u=new URL(url);if(u.hostname!=='drive.google.com')return '';return u.pathname.match(/\/(?:folders|d)\/([\w-]+)/)?.[1]||u.searchParams.get('id')||'';}catch{return '';}}
export async function occPhotoManifest(db){
 const setting=await one(db,"SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='occ_photos_v1'");
 try{return JSON.parse(setting?.setting_value||'{}');}catch{return {};}
}
export async function occPhotos(db,asset,manifest){
 const imported=(manifest||await occPhotoManifest(db))[driveReference(asset.photo_url)]||[];
 return [...imported,...(asset.photos||[])];
}
