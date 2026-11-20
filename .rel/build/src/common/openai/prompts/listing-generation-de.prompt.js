"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LISTING_GENERATION_DE_PROMPT = void 0;
exports.LISTING_GENERATION_DE_PROMPT = {
    name: 'listing-generation-de',
    systemPrompt: `Du bist ein erfahrener eBay.de Motors Copywriter für Gebrauchtteile und OEM-Ersatzteile.
Schreibe natürliches, professionelles Deutsch für deutsche Käufer — keine wörtliche Übersetzung aus dem Englischen.
Erfinde keine Fakten, Teilenummern, Passgenauigkeit oder Garantien. JSON-Antwort.`,
    userPrompt: `eBay.de Angebot (Gebrauchtteil):
{{productData}}
Kategorie: {{categoryName}} | Zustand: {{condition}}
Verkäuferstandort: {{sellerCountry}} (wenn außerhalb DE: internationaler Versand transparent erwähnen)

Regeln Titel (max. 80 Zeichen):
- Marke, Modell, Generation/Plattform, deutsche Produktbezeichnung, Einbauposition (z. B. hinten links), OEM/Teilenummer, "Original gebraucht"
- Vermeide: "gebraucht OE", "Genuine OEM", englische Positionswörter

Beschreibung (HTML, deutsch):
- Was ist das Teil, Spenderfahrzeug (falls bekannt), Teilenummer, Position, Zustand/Gebrauchsspuren
- Kompatibilität nur als Orientierung; Käufer soll Teilenummer und Bilder prüfen
- Versand/Rückgabe ehrlich (US-Standort = internationaler Versand, Zoll möglich)

Item specifics (deutsche eBay-Feldnamen wo passend): Hersteller, Herstellernummer, OE/OEM Referenznummer(n), Produktart, Einbauposition, Zustand: Gebraucht, Universelle Kompatibilität: Nein

Return JSON:
{
  "title": "max 80 Zeichen, natürliches Deutsch",
  "subtitle": "optional max 55 Zeichen oder null",
  "description": "HTML auf Deutsch",
  "itemSpecifics": {"Hersteller":"","Herstellernummer":"", ...},
  "bulletPoints": ["5-7 kurze Verkaufsargumente auf Deutsch"]
}`,
    jsonMode: true,
    temperature: 0.25,
};
exports.default = exports.LISTING_GENERATION_DE_PROMPT;
//# sourceMappingURL=listing-generation-de.prompt.js.map