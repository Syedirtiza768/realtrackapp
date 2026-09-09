import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const runtime = process.env.FASHION_PLAYWRIGHT_PATH || path.resolve('.codex-fashion-test-runtime/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({headless:true, executablePath:process.env.FASHION_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const base = process.env.FASHION_UI_URL || 'http://127.0.0.1:3922';
const permissions = ['access','dashboard.view','listings.view','listings.create','listings.update','import','review','authenticity.review','stores.view','stores.manage','incidents.manage','users.manage','roles.manage','settings.manage','publish'].map(p=>'fashion.'+p);
const item = {id:'11111111-1111-4111-8111-111111111111',sku:'FASHION-TEST',title:'Test cotton shirt',vertical:'fashion',verticalValidationStatus:'draft',brand:'Test',price:20,quantity:1,imageUrls:[],verticalAttributes:{department:'Men',size:'M',color:'Blue'}};
const errors = [];
async function session({flag=false, perms=permissions, logged=true}={}) {
 const context = await browser.newContext();
 if(logged) await context.addInitScript(()=>localStorage.setItem('mk_auth_token','mock-test-token'));
 const page = await context.newPage();
 page.on('pageerror', error=>errors.push(error.message));
 await page.route('**/api/**', async route=>{
  const url = new URL(route.request().url());
  const p = url.pathname;
  let data;
  if(p==='/api/auth/me') data={user:{id:'test-admin',email:'admin@example.test',name:'Test administrator',role:'user',roleSlug:'fashion_admin',roleName:'Fashion Admin',active:true,passwordChangeRequired:flag,permissions:perms},organizations:[]};
  else if(p==='/api/client-settings/branding') data={};
  else if(p==='/api/rbac/roles/sidebar-config/me') data={visibleModules:[]};
  else if(p==='/api/fashion/workspace') data={metrics:{listingCount:1,pendingReviewCount:1},stores:[]};
  else if(p==='/api/fashion/listings') data=[item];
  else if(p.endsWith('/review')) data={status:'pending',evidenceKeys:[],notes:null,reviewedAt:null};
  else if(p==='/api/fashion/listings/'+item.id) data=item;
  else if(['/api/fashion/stores','/api/fashion/users','/api/fashion/incidents','/api/fashion/ebay/accounts'].includes(p)) data=[];
  else if(p==='/api/catalog-import') data={imports:[],total:0};
  else { return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({message:'Unexpected fixture request '+p})}); }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 return {page,context};
}
try {
 const {page,context}=await session();
 for(const route of ['','/listings','/listings/new','/listings/'+item.id,'/import','/review','/stores','/incidents','/users','/settings']) {
  await page.goto(base+'/fashion'+route);
  await page.getByRole('heading',{level:1}).waitFor();
  assert(await page.locator('main').innerText(), 'Empty main content at '+route);
  console.log('PASS route /fashion'+route);
 }
 await page.goto(base+'/fashion/review');
 await page.getByRole('button',{name:'Review details'}).click();
 const confirmation=page.getByRole('checkbox');
 await confirmation.waitFor();
 assert.equal(await confirmation.isChecked(),false);
 assert.equal(await page.getByRole('button',{name:'Approve authenticity',exact:true}).isDisabled(),true);
 await confirmation.check();
 assert.equal(await page.getByRole('button',{name:'Approve authenticity',exact:true}).isEnabled(),true);
 console.log('PASS explicit unchecked authenticity confirmation');
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/fashion/listings/new');
 await page.getByRole('heading',{level:1}).waitFor();
 await page.screenshot({path:'fashion-mobile-editor.png',fullPage:true});
 await context.close();
 const setup=await session({flag:true});
 await setup.page.goto(base+'/fashion/listings');
 await setup.page.getByRole('heading',{name:'Set your own password'}).waitFor();
 assert(new URL(setup.page.url()).pathname==='/fashion/change-password');
 console.log('PASS required password redirect');
 await setup.context.close();
 const operator=await session({perms:['fashion.access','fashion.dashboard.view','fashion.listings.view']});
 await operator.page.goto(base+'/fashion');
 await operator.page.getByRole('heading',{name:'Fashion overview'}).waitFor();
 assert.equal(await operator.page.getByRole('navigation').getByRole('link',{name:'Users',exact:true}).count(),0);
 assert.equal(await operator.page.getByRole('link',{name:'Create listing',exact:true}).count(),0);
 console.log('PASS restricted navigation');
 await operator.context.close();
 const anonymous=await session({logged:false});
 await anonymous.page.goto(base+'/fashion/listings');
 await anonymous.page.waitForURL('**/fashion/login');
 console.log('PASS anonymous redirect');
 await anonymous.context.close();
 assert.deepEqual(errors,[]);
 console.log('PASS no browser runtime errors');
} finally {await browser.close();}

