import csv,json,os
base='/home/ubuntu/realtrackapp/output/ebay-pipeline'
src=base+'/napa_ebay_shopify_listings.seo-enriched.csv'; ready=base+'/napa_ebay_shopify_listings.ebay-listings-ready.csv'
matches={}
for p in [base+'/napa_napa_official_image_matches.json',base+'/napa_brake_official_matches.json']:
 if os.path.exists(p):
  for x in json.load(open(p)): matches[x['sku']]=x
def load(path):
 with open(path,newline='') as f:
  rd=csv.DictReader(f); return list(rd),rd.fieldnames
def write(path,rows,h):
 with open(path,'w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=h);w.writeheader();w.writerows(rows)
rows,h=load(src)
for r in rows:
 x=matches.get(r.get('Custom Label (SKU)'))
 if x:
  r['Image URL']=x['imageUrl'];r['Image Source']='Official NAPA Canada product page '+x['productUrl'];r['Image Match Confidence']='high';r['Image Validated']='Yes';r['Image Status']='validated';r['Publish Status']='content_ready_fitment_pending';r['Review Reason']='Fitment verification remains required'
write(src,rows,h)
lrows,lh=load(ready)
for r in lrows:
 x=matches.get(r.get('CustomLabel (SKU)'))
 if x:r['PicURL']=x['imageUrl'];r['Publish Status']='content_ready_fitment_pending'
write(ready,lrows,lh)
print(json.dumps({'officialMatches':len(matches),'rowsWithImages':sum(bool(r.get('Image URL')) for r in rows),'remainingMissing':sum(not r.get('Image URL') for r in rows),'src':src,'ready':ready},indent=2))
