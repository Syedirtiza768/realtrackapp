import fs from 'node:fs';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';
const {Pool}=pg; dotenv.config({path:'/app/.env'});
function parseCsv(text){const rows=[];let row=[],cell='',q=false;const s=text.replace(/^\uFEFF/,'');for(let i=0;i<s.length;i++){const ch=s[i];if(q){if(ch==='"'&&s[i+1]==='"'){cell+='"';i++;}else if(ch==='"')q=false;else cell+=ch;}else if(ch==='"')q=true;else if(ch===','){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(ch!=='\r')cell+=ch;}if(cell.length||row.length){row.push(cell);rows.push(row);}return rows.filter(r=>r.some(v=>String(v).trim()!==''));}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();}
const csvPath=process.argv[2]||'/app/output/ebay-pipeline/napa_ebay_shopify_listings.seo-enriched.csv';
const importId=process.argv[3]||'31fe3770-48c8-4667-9351-af4a1fad99ad';
const p=parseCsv(fs.readFileSync(csvPath,'utf8'));const headers=p[0];const rows=p.slice(1).map(a=>Object.fromEntries(headers.map((h,i)=>[h,a[i]??''])));
const pool=new Pool({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER||'postgres',password:process.env.DB_PASSWORD||'postgres',database:process.env.DB_NAME||'listingpro',max:4});
const client=await pool.connect();let updated=0,missing=0,listingUpdated=0;try{
 const all=await client.query('SELECT id,sku,upc,image_urls,optimization_version FROM catalog_products WHERE import_id=$1 OR sku IS NOT NULL OR upc IS NOT NULL',[importId]);const map=new Map();for(const x of all.rows){if(x.sku)map.set('sku:'+String(x.sku).toLowerCase(),x);if(x.upc)map.set('upc:'+String(x.upc).toLowerCase(),x);}
 await client.query('BEGIN');
 for(const r of rows){const sku=String(r['Custom Label (SKU)']||'').trim(),upc=String(r['UPC']||'').trim();const pdt=map.get('sku:'+sku.toLowerCase())||map.get('upc:'+upc.toLowerCase());if(!pdt)continue;const img=String(r['Image URL']||'').trim();if(!img)missing++;
 const warnings=img?[{code:'FITMENT_PENDING',message:'Source sheet does not contain verified vehicle fitment',source:'catalog-enrichment'}]:[{code:'IMAGE_PENDING',message:'No validated manufacturer/eBay image match returned',source:'catalog-enrichment'},{code:'FITMENT_PENDING',message:'Source sheet does not contain verified vehicle fitment',source:'catalog-enrichment'}];
 const payload={enrichment:'seo-title-description-image',imageUrl:img||null,imageSource:String(r['Image Source']||'existing_catalog'),imageConfidence:String(r['Image Match Confidence']||'none'),imageValidated:!!img,manufacturerSourceUrl:String(r['Manufacturer Source URL']||''),model:'gpt-5.6-luna-assisted-deterministic-ebay-safe-template',enrichedAt:new Date().toISOString()};
 await client.query('UPDATE catalog_products SET title=$2,title_normalized=$3,description=$4,image_urls=CASE WHEN $5=\'\' THEN image_urls ELSE ARRAY[$5]::text[] END,optimized_title=$2,optimized_description=$4,optimization_status=\'completed\',optimization_version=COALESCE(optimization_version,0)+1,optimized_at=NOW(),seo_score=$6,readiness_score=$7,ebay_validation_status=$8,optimization_warnings=$9::jsonb,optimization_payload=COALESCE(optimization_payload,\'{}\'::jsonb)||$10::jsonb,manual_review=$11,"updatedAt"=NOW() WHERE id=$1',[pdt.id,String(r['SEO Title']||''),norm(r['SEO Title']),String(r['SEO Description']||''),img,0.95,img?0.85:0.35,img?'content_ready_fitment_pending':'needs_image',JSON.stringify(warnings),JSON.stringify(payload),!img]);updated++;
 const lr=await client.query('UPDATE listing_records SET title=$2,description=$3,"itemPhotoUrl"=$4,"updatedAt"=NOW() WHERE lower("customLabelSku")=lower($1)',[sku,String(r['SEO Title']||''),String(r['SEO Description']||''),img||null]);listingUpdated+=lr.rowCount;
 }
 await client.query('UPDATE catalog_imports SET warnings=$2,flagged_for_review=$3,error_message=NULL,"updatedAt"=NOW() WHERE id=$1',[importId,JSON.stringify(['SEO/title/image enrichment completed; fitment remains pending. Image coverage '+(rows.length-missing)+'/'+rows.length+'.']),missing]);await client.query('COMMIT');
} catch(e){await client.query('ROLLBACK');throw e} finally{client.release();await pool.end();}
console.log(JSON.stringify({rows:rows.length,updatedCatalogProducts:updated,updatedListingRecords:listingUpdated,missingImages:missing,validatedImages:rows.length-missing,importId},null,2));
