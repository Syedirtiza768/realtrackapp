# Omni Core infographic advertisement

Created 2026-10-04. Local, original motion-graphics creative for automotive-parts
sellers. No OpenArt generation was submitted or used. Application behavior is unchanged.

## Deliverables

`assets/marketing/omni-core-ad/` contains 30-second landscape (1920x1080) and
vertical (1080x1920) H.264/AAC MP4s, posters, a storyboard contact sheet, an
original synthesized soundtrack, and the editable `render.py` source.
Run `python assets/marketing/omni-core-ad/render.py --preview` for posters and
`python assets/marketing/omni-core-ad/render.py` to render both videos.
Requires Python, Pillow, NumPy, FFmpeg, and Windows Segoe UI fonts.

## Creative and claim grounding

Audience: automotive parts sellers and catalog/e-commerce operators.
Positioning: **From parts to published.** CTA: **Book a demo.** No destination
URL was supplied, so none is fabricated; pair the ad with the campaign's demo link.

| Time | Message | Visual |
|---|---|---|
| 0–5s | Great parts. Too much busywork. | A rotating brake rotor surrounded by disconnected work items |
| 5–10s | Your catalog. A smarter starting point. | Catalog → AI assistance → listing draft |
| 10–15s | Put fitment at the center. | Year/make/model and a review checklist |
| 15–20s | More stores. One workflow. | A reviewed listing branching to connected eBay stores |
| 20–25s | Keep the whole picture in view. | Listings, inventory, and orders overview |
| 25–30s | From parts to published. Book a demo. | Brand and import/enrich/review/publish loop |

Sources inspected: `docs/AGENT_SYSTEM_MEMORY.md`, `docs/context/CURRENT_STATE.md`,
`docs/context/FEATURE_REGISTRY.md`, `docs/architecture/ARCHITECTURE.md`,
`src/App.tsx`, `src/components/layout/Shell.tsx`, and fitment/order controller
routes. The ad uses the canonical Omni Core brand, depicts schematic workflow
illustrations rather than live application screenshots, and presents AI as
assistance with operator review. It makes no numerical revenue, speed, accuracy,
inventory-sync guarantee, or unsupported marketplace claim. eBay is named as
the integration; no partner endorsement is implied. Other verticals are outside
this campaign's automotive audience.

All diagram artwork and music are generated locally from original drawing and
synthesis instructions. The video works muted; music accompanies the on-screen
copy. No customer data, third-party stock recordings, or live account imagery
are used. The font is rendered with the local Windows installation.

## Verification

Passed: all six landscape and vertical scene layouts were visually inspected,
including both closing cards and a frame extracted from the encoded video.
Both MP4s are exactly 30 seconds at 30 fps, H.264/yuv420p with 48 kHz stereo AAC,
and passed full FFmpeg decoding without errors. The instrumental was adjusted
after measuring output levels. App tests/builds are not applicable to these
standalone marketing assets.
