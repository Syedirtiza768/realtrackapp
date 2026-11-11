# Infiniti Q50 pipeline title year ranges — 2026-10-04

Pipeline job: `35833336-07b2-42b3-8661-083390b55e12`.

The repair updated all 61 published eBay Inventory item titles and the matching
catalog/listing records. The CSV export's `Title` cells were updated for all 62
SKUs, including one soft-deleted draft; that draft remains deleted and has no
eBay listing. Final titles use the year span below, begin with
`YYYY-YYYY Infiniti Q50`, and fit eBay's 80-character title limit. eBay
Inventory titles were read back after the repair. A backup of the original CSV
is stored beside the export with suffix
`.before-year-range-2026-10-03T20-36-24-973Z.bak`.

The ranges are title identification hints. They did not approve compatibility:
all 62 catalog rows remain `fitment_status=needs_review` with manual review
enabled, and no compatibility data was published. Vehicle configuration,
production-date splits, trim, drivetrain, engine, and VIN must still be checked
before accepting an individual fitment.

## Applied range by exact MPN

| MPN | Title years |
| --- | --- |
| 682004GF0A | 2014–2016 |
| 248104GU5C | 2014–2015 |
| 48430-4GA5A | 2015–2019 |
| 28387-4HB2C | 2014–2016 |
| 25915-4HB3B | 2015–2016 |
| 28231-4HB0A | 2014–2019 |
| 281764GA0A | 2014–2015 |
| 689204GF0A | 2014–2024 |
| 681024GF0A | 2014–2024 |
| 685004GF1C | 2015–2016 |
| 67810-4GA0A | 2014–2024 |
| 68761-4GA1A | 2014–2019 |
| 68760-4GA0A | 2014–2019 |
| 28176-4GA0C | 2014–2020 |
| 678704GF1A | 2014–2024 |
| 14001-2V70A | 2015–2019 |
| 14041-4GD3A | 2015–2019 |
| 23300-4GD0C | 2015–2019 |
| 24011-4HK0A | 2016–2017 |
| 31020-HG00D | 2015–2018 |
| 16500-2V70A | 2015–2019 |
| 16554-4GD0B | 2015–2019 |
| 24350-5CA0A | 2016–2024 |
| 17040-6HA0A | 2015–2019 |
| 14411-HG01A | 2015–2019 |
| 16118-HG00B | 2016–2019 |
| 23100-HG00B | 2016–2019 |
| 92600-4GC1A | 2016–2019 |
| 23703-HG00C | 2015–2019 |
| 31020-39X0A | 2016–2019 |
| 31100-39X0A | 2016–2019 |
| 37000-4HZ0A | 2016–2019 |
| 38301-4GD3A | 2016–2024 |
| 39600-4GB0A | 2014–2024 |
| 39601-4GB0A | 2014–2024 |
| 11320-4GA0A | 2014–2024 |
| F31014GAMA | 2014–2020 |
| 638404GA0B | 2014–2024 |
| 638414GA0B | 2014–2023 |
| 638284GA0A | 2014–2024 |
| 638294GA0A | 2014–2024 |
| F31004GAMA | 2014–2020 |
| 56230-1MA0B | 2014–2024 |
| 54618-1MA0C | 2014–2024 |
| E6210-4GA0C | 2014–2016 |
| 55320-1MA1A | 2014–2019 |
| 55240-1MA1B | 2014–2024 |
| 55157-1MA1B | 2014–2024 |
| 55159-1MA1A | 2014–2024 |
| 55152-1MA1B | 2014–2024 |
| 40173-EG000 | 2014–2024 |
| 43019-5CA0A | 2014–2023 |
| 43018-5CA0A | 2014–2024 |
| 43202-4GA0B | 2014–2024 |
| 55502-1MA0C | 2015–2024 |
| 55501-1MA0C | 2015–2024 |
| 551A0-1MA0D | 2014–2024 |
| 551B0-1MA1B | 2014–2024 |
| 55120-1MA0D | 2014–2024 |
| 55400-5CA0A | 2014–2024 |
| 1S93720DLB | 2014–2024 |

## Source references and caveats

Exact-part application checks included the following manufacturer and OEM
catalog records:

- Instrument panel `68200-4GF0A`: [Infiniti Parts Deal](https://www.infinitipartsdeal.com/parts/infiniti-panel-pad-asm~68200-4gf0a.html) lists Q50 2014–2016. Production-date split notes appear in the [2015 catalog](https://www.infinitipartsdeal.com/parts-list/2015-infiniti-q50/body_front_roof_floor/instrument_panel_pad_cluster_lid.html); confirm VIN/build date near the cutoff.
- Cluster `248104GU5C`: [PartSouq](https://partsouq.com/shop/product/248104GU5C-nissan-meter-assy-comb/15608376) lists Q50 2.0L Turbo Premium, General/Asia, from 05/2014; the donor is 2015. The regional and trim restriction requires VIN verification.
- Radio amplifier `28231-4HB0A`: [Infiniti Parts Deal](https://www.infinitipartsdeal.com/parts/infiniti-amplifier-radio~28231-4hb0a.html) lists Q50 applications through 2019.
- Air duct `16554-4GD0B`: [Infiniti Parts Deal](https://www.infinitipartsdeal.com/oem-infiniti-q50-air_intake_coupling.html) lists the 2.0T application for 2015–2019.
- Engine parts `14001-2V70A` and `14041-4GD3A`: [Q50 2.0T manifold catalog](https://www.infinitipartsdeal.com/parts-list/2018-infiniti-q50/engine_mechanical/manifold.html); the [intake manifold page](https://www.infinitipartsdeal.com/parts/infiniti-manifold-intake~14001-2v70a.html) covers 2015–2019.
- Starter `23300-4GD0C`: [Infiniti Parts Deal](https://www.infinitipartsdeal.com/parts/infiniti-motor-assy-starter~23300-4gd0c.html), Q50 2.0T 2015–2019.
- Engine-room harness `24011-4HK0A`: [2017 wiring catalog](https://www.infinitipartsdeal.com/parts-list/2017-infiniti-q50/body_electrical/wiring.html) identifies the production boundary as 12/2015–07/2016; VIN/build-date verification is needed at that split.
- Glove-box frame `68102-4GF0A`: [Infiniti USA parts](https://parts.infinitiusa.com/v-2019-infiniti-q50--red-sport--3-0l-v6-gas/body--glove-box), Q50 2014–2024.
- Instrument-panel cover `68920-4GF0A`: [Infiniti Parts Deal](https://www.infinitipartsdeal.com/parts/infiniti-cover-instrumen~68920-4gf0a.html), Q50 2014–2024.
- Dashboard vents: [68761 predecessor application](https://www.infinitipartsdeal.com/parts/infiniti-ventilator-asmy~68761-4ga0a.html) covers Q50 2014–2019; [Infiniti USA 68760 successor](https://parts.infinitiusa.com/parts/infiniti-side-ventilator-assembly-right-687604ga1a) lists 2014–2024. The stored `68760-4GA0A` part may have an earlier cutoff than its successor.
- Reinforcement beam `678704GF1A`: the [Infiniti instrument-panel catalog](https://parts.infinitiusa.com/v-2016-infiniti-q50--base--2-0l-l4-gas/body--instrument-panel) shows related `67870-4GF0A` applications for 2014–2024. The catalog suffix differs from the stored MPN; verify the exact suffix before compatibility approval.
- Intake/fuel/charging applications: [17040-6HA0A](https://www.infinitipartsdeal.com/parts/infiniti-fuel-pump-in-tank~17040-6ha0a.html) lists Q50 2.0T 2015–2019; [23100-HG00B](https://parts.infinitiusa.com/p/Infiniti_2004_G35-COUPE-BASIC/Alternator-Generator-Alternator/89448906/23100-HG00B.html) lists Q50 2016–2019.
- Transmission `31020-39X0A`: [Z1 Motorsports OEM catalog](https://www.z1motorsports.com/auto-transmission/infiniti/oem-16-19-infiniti-q50-20t-automatic-transmission-rwd-p-39290.html), Q50 2.0T RWD 2016–2019. This MPN belongs to the deleted draft only.
- Fender liners: [63840-4GA0B](https://www.infinitipartsdeal.com/parts/infiniti-protector-front~63840-4ga0b.html) lists 2014–2024; [63841 catalog](https://refinishsupply.com/wp-content/uploads/2024/03/CPP-Catalog-24.pdf) lists Q50 2014–2023.
- Rear axles `39600-4GB0A` / `39601-4GB0A`: [Infiniti Wholesale Direct rear axle catalog](https://www.infinitiwholesaledirect.com/v-2021-infiniti-q50--red-sport-400--3-0l-v6-gas/universals-and-rear-axle--rear-axle).
- Rear suspension: exact-part references include [40173-EG000 control-arm catalog](https://www.infinitipartsdeal.com/parts-list/2020-infiniti-q50/suspension-components-control-arm.html), [55159-1MA1A bushing](https://www.infinitipartsdeal.com/parts/infiniti-bush~55159-1ma1a.html), [55157-1MA1B bushing](https://www.infinitipartsdeal.com/parts/infiniti-bush~55157-1ma1b.html), [56230-1MA0B stabilizer bar](https://www.infinitipartsdeal.com/parts/infiniti-bar-torsion-re~56230-1ma0b.html), [E6210-4GA0C shock](https://www.infinitipartsdeal.com/parts/infiniti-shock-absorber~e6210-4ga0c.html), [55320-1MA1A mount](https://www.infinitipartsdeal.com/oem-infiniti-q50-shock_and_strut_mount.html), [55120-1MA0D lateral arm](https://parts.infinitiusa.com/parts/infiniti-lateral-arm-551201ma0d), and [55400-5CA0A crossmember](https://www.infinitipartsdeal.com/parts/infiniti-member-compl-rear-suspension~55400-5ca0a.html). The E6210 page limits the cited shock application to 2014–2016 3.7L; confirm engine and drivetrain before compatibility approval.
- Engine assembly `1S93720DLB`: [Infiniti USA replacement page](https://parts.infinitiusa.com/parts/infiniti-engine-assembly-m274-1s93720dlc) lists the successor application for Q50 2014–2024. Engine configuration remains VIN-specific.

The title update changed only each Inventory item's product title and the
corresponding database/export title fields. It preserved current product
details, availability, condition, offers, prices, quantities, descriptions,
photos, listing status, and compatibility records. eBay documents that an
Inventory item's product title supplies the live listing title and that a
successful Inventory item replacement updates an active listing's catalog
product data: [Inventory item to offer](https://developer.ebay.com/api-docs/sell/static/inventory/inventory-item-to-offer.html),
[Inventory API workflows](https://developer.ebay.com/api-docs/sell/static/inventory/pbse-phase2-rest-workflows.html),
[managing inventory items](https://developer.ebay.com/api-docs/sell/static/inventory/managing-inventory-items.html).
