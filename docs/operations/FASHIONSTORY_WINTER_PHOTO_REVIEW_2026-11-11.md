# Fashion Story winter listings — remote photo review, 2026-11-11

Companion to [FASHIONSTORY_WINTER_REIMPORT_2026-11-11.md](FASHIONSTORY_WINTER_REIMPORT_2026-11-11.md).

**Method.** At the operator's instruction, Claude reviewed the listing photos of all
557 imported items from contact sheets, with no separate human review and no physical
inspection. The 105 items from commonly counterfeited brands (Tommy Hilfiger, The North
Face, Calvin Klein, Plein Sport, Ralph Lauren, Lululemon, Lacoste, Jordan, Armani,
Carhartt, Kenzo, Diesel, Patagonia, Boss, Stone Island) were reviewed with up to 12
photos each. The other 452 were reviewed with the first and last three photos. Checks:
brand label and care tag match the stated brand; logo and construction are consistent;
the photos show the actual item (not stock or retailer images); title facts (type,
size, department, material) match the label.

**Outcome.** 537 approved (`fashion_reviews.status = approved`, `authenticity_confirmed
= true`, note "Remote AI photo review…"). 20 held as `draft`/`pending`. Corrections
below marked "fix" were applied by import `284a4042` before approval.

Verdicts: PASS = labels/tags/construction consistent with the brand; FAIL = counterfeit
indicator or brand misrepresentation (FAIL items with a clear label brand were corrected
to that brand, then approved; FA8-798-SU was not); HOLD = not approved until fixed.

| SKU | Verdict | Finding | Fix |
|---|---|---|---|
| FA8-798-SU | FAIL | Waistband label reads "SITONG" + compass + "LAND" (misspelled Stone Island) | Do not approve; end the live eBay listing |
| FA10-1224 | PASS | NBA neck label; Lakers care tag | Brand -> NBA |
| AV2-1185 | PASS | Label "4TH + RECKLESS PETITE"; 100% polyurethane | Brand -> 4th & Reckless |
| AV12-3017 | PASS | Ralph Lauren Sport label + care tag | |
| AV19-4882 | PASS | Giorgio Armani labels RN#103723 CA#37360, Made in Italy | Remove retailer photos 1-2 |
| AV19-4887 | PASS | same label set | Remove retailer photos 1-2 |
| AV19-4894 | HOLD | Every photo identical to AV19-4882 (same size 44 item) | Duplicate listing: sell as qty 2 on AV19-4882 or photograph the second unit |
| AV19-4896 | PASS | own size-40 labels | Remove retailer photos 1-2 |
| AV2-1112 | PASS | Plein Sport DPAPS3321, made in Jordan | |
| AV2-1139 | PASS | Lauren Ralph Lauren label | |
| AV2-1169 | PASS | Plein Sport DFPS3262, 8059024 barcode | |
| AV2-1188-M | HOLD | Photos are the size S item (label "S P"); same photos as AV2-1188 | Needs its own photos |
| AV22-5984 | HOLD | Jordan label ok, but front photo is a retailer image; only back + label are real | Needs a real front photo |
| AVP-KLZ-3629 | PASS | Lululemon logo, waistband print | |
| AVP-KLZ-3650 | PASS | Lululemon logo, size dot 4 | |
| AVP-KLZ-3658 | PASS | Lululemon logo, size dot 4 | |
| AVP-KSC-3439-XXL | PASS | Calvin Klein extra fine merino | |
| AVP-MFC-1298-L | PASS | CK italian merino | Title says "Light Gray Crewneck"; item is cream V-neck |
| AVP-MFC-25032-L | PASS | CK italian yarn | |
| AVP-MFC-3149-L | PASS | CK RN#36543 CA#50900, 100% merino | Title says "Blue ... Cotton"; item is purple merino. Category is Women's |
| AVP-MFC-3187-XXL | PASS | CK merino, made in Jordan | |
| AVP-MFC-3194-L | PASS | CK italian merino | Title says "Graphic Crewneck"; item is plain quarter-zip |
| AVP-MFC-3205-M | PASS | CK, 100% wool | Title says "Cotton" |
| AVP-MFC-3208-M | PASS | CK italian merino | Title says "Graphic ... NWT"; plain V-neck, no tags shown |
| AVP-MFC-3303-XL | PASS | CK extra fine merino | Title says "Graphic"; plain V-neck |
| AVP-MSC-2774-L | PASS | Lauren hand knit, RN 54050 CA 08349, lambswool | |
| AVP-MSC-2956-XL | PASS | Vintage Tommy flag label, 100% Shetland wool | Title says "Cotton" |
| AVP-MSC-3307-M | PASS | CK extra fine merino | |
| AVP-MSC-6030-M | PASS | Tommy Hilfiger Jeans label | |
| AVP-WFC-3311-L | PASS | Tommy Hilfiger label, 100% cotton | Title says Men; women's cut (WFC) |
| AVP-WFC-3895-L | PASS | Tommy Hilfiger label | Title says Men's; women's cut; orange stain on sleeve must be disclosed |
| AVP-WFC-3925-XL | PASS | Lauren Ralph Lauren green label | Title says Men's; women's dolman cut |
| AVP-WLZ-3641 | PASS | Lululemon logo | |
| AVP-WLZ-3672 | PASS | Lululemon logo | Title says Men's; women's cut leggings |
| AVP-WSC-1213-L | PASS | CK extra fine merino | |
| AVP-WSC-2791-M | FAIL | Label is **Eddie Bauer** (lambswool), not Ralph Lauren | Brand misrepresentation; retitle as Eddie Bauer |
| AVP-WSC-2800-L | PASS | Lauren RL wool/cashmere label | |
| AVP-WSC-2881-XL | PASS | Calvin Klein label | Title says "Boys Light Gray Pullover Hoodie Kangaroo Pocket"; item is a women's beige cowl-neck sweater |
| AVP-WSC-2977-M | PASS | Lauren hand knit label | |
| FA1-156 | PASS | TNF labels | Title says Men's; women's belted cut |
| FA10-1144 | PASS | Polo by Ralph Lauren | |
| FA10-1278 | PASS | TNF Denali, Polartec | |
| FA11-1486 | PASS | TNF Womens label | |
| FA11-1491 | PASS | Carhartt RN#14806, Dearborn MI | |
| FA14-1826 | PASS | Tommy + tommy.com care | |
| FA14-1913 | PASS | Carhartt (WIP style) | |
| FA15-2033 | PASS | Plein Sport tiger label, tiger stopper | |
| FA15-2042 | PASS | Plein Sport | |
| FA15-2044 | PASS | Plein Sport | Tag says M, title says S |
| FA15-2045 | PASS | Plein Sport, hang tag | |
| FA15-2070 | PASS | Plein Sport | Tag says XS, title says S |
| FA16-2256 | PASS | TNF label | Title says Grey; item is pink |
| FA16-2258 | PASS | Carhartt VAT DE label | |
| FA16-2313 | PASS | Lacoste Sport | |
| FA16-2343 | PASS | TNF logo | |
| FA16-2349 | PASS | Tommy embroidery | Photo 7 is the store "Verification Process" banner: remove |
| FA16-2364 | PASS | tommy.com care | |
| FA16-2401 | PASS | Tommy label | |
| FA16-2416 | PASS | tommy.com care | |
| FA17-2481 | PASS | Calvin Klein label | |
| FA17-2483 | PASS | TNF Womens label | |
| FA17-2520 | PASS | TNF Youth label | |
| FA2-178-SA | PASS | TNF logo | Photos 1, 5 show a full-zip jacket; listing is a mock-neck pullover: two items mixed |
| FA21-3908 | PASS | Lacoste Sport | |
| FA23-4565 | PASS | Hilfiger Denim | |
| FA24-4937 | PASS | Tommy | |
| FA24-4947 | PASS | Tommy | |
| FA25-5500 | PASS | Polo by RL kids label | |
| FA26-5769 | PASS | TNF Youth label | |
| FA26-5770 | PASS | Kenzo Paris label | |
| FA26-5776 | PASS | TNF Mens label | |
| FA26-5779 | PASS | TNF Womens label | |
| FA26-5782 | PASS | Polo RL label | |
| FA26-5786 | PASS | Lacoste Sport | |
| FA26-5788 | PASS | Tommy Jeans | |
| FA26-5789 | PASS | TNF Mens label | |
| FA26-5830 | PASS | TNF Womens label | |
| FA27-6282 | PASS | Lacoste Sport | |
| FA27-6285 | PASS | Jordan RN#56323 | |
| FA27-6322 | PASS | Tommy | |
| FA27-6422 | PASS | Jordan label | |
| FA27-6430 | PASS | Lacoste | |
| FA27-6456 | PASS | Diesel RN 93243 | |
| FA28-6941 | PASS | Kenzo Sport label | |
| FA28-6980 | PASS | CK Jeans | |
| FA30-7938 | PASS | CK Jeans | |
| FA30-7947 | PASS | Lacoste | |
| FA30-8067 | PASS | Jordan RN#56323 | |
| FA30-8099 | PASS | Hugo Boss | |
| FA30-8177 | PASS | Jordan, Nike DH9504-091 | Tag says L, title says M |
| FA4-110 | PASS | Tommy | Last photo is a retailer stock image: remove |
| FA4-129 | PASS | Tommy RN 77806 | |
| FA4-131 | PASS | Tommy | |
| FA4-253-SA | PASS | Patagonia Synchilla | |
| FA4-264-SA | HOLD | No Lululemon logo or label visible in any photo | Cannot verify brand; needs label photo |
| FA4-293-SU | HOLD | Only a small reflective logo dot; no label photo | Needs label photo |
| FA4-311-SU | PASS | Tommy neck label | |
| FA6-418-SA | PASS | Tommy premium cotton label | Title typo "Fran's" |
| FA6-428-SU | PASS | Polo Golf label | |
| FA6-429-SU | PASS | BOSS orange label | Two holes on front (photo 6) must be in the condition notes |
| FA6-503-SA | PASS | Lacoste size 40 | |
| FA6-545-SU | HOLD | All 3 photos are retailer stock/model images, none of the actual item | Needs real photos |
| FA6-551-SU | PASS | tommy.com care label | Photos 1-2 are retailer stock: remove |
| FA7-705-SA | PASS | TNF, Polartec | Photo 1 is a stock model image: remove |
| FA7-750-SU | PASS | Lacoste size 5 | |
| FA8-787-SA | PASS | Hilfiger Denim label | Photo 3 is a stock model image: remove |

## Bulk review (non-risk brands), sheets bulk_001..bulk_028

All labels consistent with the stated brand except as listed.

| SKU | Verdict | Finding | Fix |
|---|---|---|---|
| FA26-5875 | PASS (fix) | Label is Russell; HanseTrans is a printed company logo | Brand -> Russell; title |
| FA10-1267 | FAIL | Listed Kappa; label, tab and chest logo are **Levi's** | Brand misrepresentation; Brand -> Levi's, retitle |
| FA12-1577 | PASS | Russell label | Title says Full Zip; item is a pullover |
| FA30-7962 | PASS | Jack & Jones print | Title says Hoodie; crewneck |
| FA12-1548 | PASS | Champion label | Title says Pullover Hoodie; crewneck sweatshirt |
| FA12-1523 | PASS | UA label | Contains the Verification Process banner: remove |
| FA20-3493 | PASS | adidas label | Contains the Verification Process banner: remove |
| FA1-003 | PASS | adidas x Parley tag | Photos 5-6 are retailer stock: remove |
| FA1-067 | PASS | Ted Baker | Photos 2-4 are retailer stock: remove |
| FA1-152 | PASS | River Island petite label | Photo 3 is a stock model image: remove |
| FA6-548-Su | PASS | Unbranded vintage | |
| FA10-1224 | PASS | NBA neck label | Brand -> NBA |
| AV2-1275 | HOLD | Unbranded hoodie dress; title says "Sewing Pattern" (it is a garment) and "Tiana" is not on the label | Retitle; Brand -> Unbranded |
| FA6-483-SU | PASS | Puma label | Photos 1-3 are retailer stock: remove |
| FA7-691-SU | PASS | adidas | Photos 1-2 are retailer stock: remove |
| FA28-6859 | PASS | Puma label | Photo 1 is retailer stock: remove |
| FA28-7069 | PASS | Champion label | Label is kids YRS 13/14; title says Men's XL |
| AV2-1130 | FAIL | Listed H&M; label and swing tag are **PIECES** | Brand -> Pieces, retitle |
| FA9-847-SU | HOLD | FC Porto club scarf, no licence label | Unlicensed club merchandise; needs licence evidence |
| FA9-848-SU | PASS | Supporters' scarf (Spartak Trnava / J. Vlasko), unbranded | |
| FA14-2000 | FAIL | Listed Nike; logo and label are **adidas** (kids 13-14A) | Brand -> adidas, retitle |
| FA15-2121 | PASS | Nike Dri-FIT label | Label says XS; title says XL |
| AVP-WTH-4097-L | HOLD | Vintage Hanes Heavyweight 50/50 polo-collar **T-shirt**, adult L, Made in USA; no tags | Title says "Boys ... Sweater ... NWT": wrong type, wrong department, NWT claim unsupported |
| AV2-1185 | PASS | "4TH + RECKLESS PETITE" label | Brand -> 4th & Reckless |
| AV2-1208 | PASS | Official LFC tag and swing tag | |
| FA6-537-SA | FAIL | Listed Columbia; garment is a **Superdry** anorak; photo 1 is a stock model image | Brand -> Superdry, retitle, remove photo 1 |
| FA26-5940 | PASS | Nike label | Photo 4 is an "Artistic Haul" promotional banner: remove |
| FA30-8175 | PASS | Napapijri label | |
| FA14-1969 | PASS | Puma label | Verification Process banner: remove |
| FA29-7568 | PASS | Wrangler label | Verification Process banner: remove |
| FA12-1695 | PASS | adidas | Verification Process banner: remove |
| FA17-2476 | PASS | Champion ECO Authentic label | Title says "Reverse Weave ... Hoodie"; item is an ECO crewneck |
| FA17-2516 | PASS | Official NHL licensed label | |
| FA26-5791 | PASS | NBA label | Title says Hoodie; item is a quarter-zip, no hood |
| FA19-3221 | PASS | Nike/NBA Nets | Verification Process banner: remove |
| FA6-673-SU | HOLD | Photos 1-2 are Nike stock model images; the actual pants show no Nike label or logo in any photo | Cannot verify brand; needs label photo |
| FA27-6247 | PASS (fix) | Adult Levi's label size M (no youth sizing) | Department -> Men (fits category 15687); drop "Boys" from title |
| FA10-1389 | PASS | Reebok label | Verification Process banner: remove |
| FA16-2220 | PASS | adidas care label | Verification Process banner: remove |
| FA19-3222 | PASS | adidas care label | Verification Process banner: remove |
| FA25-5438 | PASS | Umbro care label | Verification Process banner: remove |
| AV14-3670 | PASS | Nike care label | Verification Process banner: remove |
| FA16-2265 | PASS | Nike care label | Verification Process banner: remove |
| FA16-2273 | PASS | adidas care label | Verification Process banner: remove; title says Hoodie, item is a crewneck |
| FA26-5824 | PASS | Nike care label | Verification Process banner: remove; title says Hoodie, item is a crewneck |
| AVP-6573-XL | FAIL | Listed GAP; label is **H&M DIVIDED** | Brand -> H&M, retitle |
| AVP-WSC-2803-M | FAIL | Listed "Patachou Kids"; label is **Patagonia** women's/adult M, a zip-front cable-knit hooded sweater | Brand -> Patagonia, retitle |
| FA15-2064 | FAIL | Listed "LubnaDes"; label is **Desigual** | Brand -> Desigual, retitle |
| AVP-WSC-1254-M | PASS | L.L.Bean label | Item is a cable-knit sweater hoodie, title says "Knit Polyester" |
| FA15-2069 | PASS | Automobili Lamborghini licensed label | |
| FA22-4075 | HOLD | Brand "Escape into Nature" not on any label; care label is a German importer | Brand unverified -> Unbranded |
| AVP-MFC-3037-L | PASS | Brooks Brothers care label | Title says Cardigan; item is a V-neck pullover |
| AVP-WSC-1262-M | HOLD | Photos show a light-blue short-sleeve **T-shirt**, not an L.L. Bean cable-knit cardigan | Photos belong to another item; needs correct photos |
