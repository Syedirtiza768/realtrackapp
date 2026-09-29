import csv,json,re,requests,time,os,urllib.parse
from concurrent.futures import ThreadPoolExecutor,as_completed
IN='/home/ubuntu/realtrackapp/output/ebay-pipeline/napa_ebay_shopify_listings.seo-enriched.csv'
OUT='/home/ubuntu/realtrackapp/output/ebay-pipeline/napa_napa_official_image_matches.json'
rows=[r for r in csv.DictReader(open(IN)) if not r.get('Image URL')]
def compact(s): return re.sub(r'[^A-Za-z0-9]','',s or '').upper()
def candidates(r):
    m=r.get('MPN',''); c=compact(m); t=r.get('Product Type',''); o=[]
    def add(x):
        if x and x not in o:o.append(x)
    if t=='Brake Caliper': add('ADC'+c); add('ACA'+c); add('UP_'+c)
    elif t=='Disc Brake Rotor':
        if c.startswith('248'): add('VLR'+c)
        add('NB'+c); add('NBR'+c); add('UP_'+c); add('VLR'+c); add(c)
    elif t=='Wheel Bearing':
        add('PGB'+c); add(c)
    elif t=='Brake Pads':
        add('ADO'+c); add('FNP'+c); add('UP_'+c); add(c)
    elif t=='Brake Shoes':
        add(c); add('NBS'+c); add('NUP'+c); add('UP_'+c)
    elif t=='Disc Brake Hardware Kit': add('UP_'+c); add('UP'+c); add(c)
    elif t=='Brake Hose': add('UP_'+c); add('UP'+c); add(c); add('NCH'+c)
    elif t=='Slave Cylinder': add('NCF'+c); add(c)
    elif t in ('Ball Joint',):
        add('PCC'+c); add('NCP'+c); add('NCT'+c); add('ATM'+c); add(c)
    elif t in ('Control Arm','Control Arm Bushing','Knuckle Bushing','Stabilizer Bar Link','Stabilizer Bar Bushing','Stabilizer Bar Bushing Kit','Suspension Track Bar','Trailing Arm Bushing','Mounting Kit','Camber Kit (set Of 2)'):
        add('NCP'+c); add('NCT'+c); add('NCQ'+c); add('PCC'+c); add(c)
    elif t in ('Tie Rod End','Tie Rod'):
        if c.startswith('26') or c.startswith('269'): add('NCD'+c)
        add(c); add('NCP'+c); add('NCD'+c)
    elif t in ('Shock Absorber','Suspension Strut'):
        add(c); add('NPS'+c); add('NS'+c); add('NSS'+c); add('NCA'+c); add('NAPA'+c)
    elif t in ('Steering Shaft','Steering Rack & Pinion','Power Steering Pump','Power Steering Pulley'):
        add(c); add('NPS'+c); add('NCP'+c); add('NCA'+c)
    elif t in ('Starter Motor','Alternator'):
        add('RAY'+c); add('NAD'+c); add('NAA'+c); add('NAPA'+c); add(c)
    elif t in ('Air Filter','Cabin Filter','Oil Filter'):
        add(c); add('FIL'+c)
    elif t in ('Water Pump',):
        add('TFW'+c); add('NWP'+c); add(c)
    elif t in ('Fuel Pump',):
        add('NEP'+c); add('NFP'+c); add('EFP'+c); add(c)
    elif t in ('Thermostat Housing Assembly',):
        add('NOE'+c); add('ATM'+c); add(c)
    elif t in ('Power Window Switch','Positive Battery Terminal'):
        add('EWS'+c); add('NPS'+c); add('ECH'+c); add(c)
    else:
        add(c); add('NCP'+c); add('NPS'+c); add('NOE'+c); add('RAY'+c)
    return o
def resolve(r):
    needle=compact(r.get('MPN',''))
    for code in candidates(r):
        url='https://r.jina.ai/http://www.napacanada.com/en/p/'+urllib.parse.quote(code,safe='_')
        try:
            resp=requests.get(url,headers={'User-Agent':'Mozilla/5.0'},timeout=30)
            text=resp.text or ''
        except Exception:
            continue
        first=(text.splitlines()[0] if text else '')
        if 'Page Not Found' in first or 'Security verification' in first or len(text)<5000:
            continue
        if needle and needle not in compact(text):
            continue
        imgs=re.findall(r'https?://media\.napacanada\.com/is/image/GenuinePartsCompany/\d+[^ )\s]*',text)
        imgs=[x.replace('&amp;','&') for x in imgs if 'webproof' in x]
        if not imgs:
            continue
        # Prefer xlarge, then large, and remove duplicates
        uniq=[]
        for x in imgs:
            if x not in uniq: uniq.append(x)
        uniq.sort(key=lambda x: ('webproofxlarge' not in x, len(x)))
        return {'sku':r.get('Custom Label (SKU)',''),'mpn':r.get('MPN',''),'productType':r.get('Product Type',''),'code':code,'productUrl':'http://www.napacanada.com/en/p/'+code,'imageUrl':uniq[0],'title':first.replace('Title: ','')[:300]}
    return None
out=[]; done=0
with ThreadPoolExecutor(max_workers=12) as ex:
    futs=[ex.submit(resolve,r) for r in rows]
    for f in as_completed(futs):
        done+=1
        try:
            x=f.result()
            if x: out.append(x)
        except Exception: pass
        if done%25==0: print('[napa-resolve]',done,'/',len(rows),'matches',len(out),flush=True)
open(OUT,'w').write(json.dumps(sorted(out,key=lambda x:x['sku']),indent=2)+'\n')
print(json.dumps({'rows':len(rows),'matches':len(out),'missing':len(rows)-len(out),'out':OUT},indent=2))
