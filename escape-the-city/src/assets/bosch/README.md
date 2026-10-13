# Bosch-Boomman — sprites voor Escape the City

**9 losse transparante onderdelen**, in zowel WebP (voor de PWA) als PNG (bronbestanden).

## Bestandsstructuur

- `head/{human,bird,fish}.webp`
- `body/{egg,barrel,tower}.webp`
- `legs/{trees,human,bird}.webp`

Iedere afbeelding heeft een **identiek canvas van 512 x 640 pixels**, met de illustratie reeds uitgelijnd in dezelfde coördinaten. Stukjes NIET afzonderlijk bijsnijden bij gebruik in de app. De achtergrond is echt transparant (alpha), geen ingeprinte checkerboard of perkament.

## Implementatie in de repo

Plaats de drie mappen bijvoorbeeld onder `escape-the-city/src/assets/bosch/`, en importeer de bestanden via Vite, of plaats ze onder `escape-the-city/public/bosch/` en gebruik URLs onder `/escape-the-city/bosch/`.

Render in deze Z-volgorde: `legs` (achter), `head` (midden), `body` (voor). Alle drie de lagen tegelijk op exact dezelfde positie en grootte; **geen aparte object-fit of transform per laag**:

```tsx
<div className="bosch-figure">
  <img src={legsSrc} alt="" draggable={false} />
  <img src={headSrc} alt="" draggable={false} />
  <img src={bodySrc} alt="" draggable={false} />
</div>
```

```css
.bosch-figure { position: relative; width: min(100%, 256px); aspect-ratio: 4 / 5; }
.bosch-figure img { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
```

De 3 selectiegebieden en on-screen knoppen komen als interactieve HTML **bovenop** de lagen. Zorg dat de figuur een gecombineerde toegankelijke beschrijving heeft. De afbeelding wisselt na swipen/tikken, maar alleen de knop `Wek het monster tot leven` verstuurt een definitieve poging.

## Antwoorddata

De bestaande `composite`-sleutels moeten behouden blijven, inclusief `object` (voor benen):

```json
{"head":"human","body":"egg","object":"trees"}
```

Gebruik een **nieuwe forward-only Supabase migratie** (niet 038 aanpassen) en wijzig `game.ts`, hint en voltooiingsbeeld mee.

## Oorspronkelijk schilderijfragment

De illustraties zijn gegenereerde kunst in de stijl van Bosch, niet een letterlijke reproductie van de Boomman. Voor het historisch originele eindbeeld dient nog het daadwerkelijke schilderijfragment als apart bestand in de repo gezet te worden:
https://commons.wikimedia.org/wiki/File:Bosch_Jardin_des_delices_detail.jpg
Bron: Jheronimus Bosch, *De tuin der lusten*, rechterpaneel, detail Boomman; afbeelding aangeduid als Public Domain op Wikimedia Commons. **Dit origineel is niet in de zip opgenomen.**

## Kwaliteitsnotitie

Dit is een eerste bruikbare assetset voor de game. Omdat AI-art geen perfecte geometrische reconstructie is, is iedere combinatie visueel verwisselbaar maar kan het detailwerk niet letterlijk overeenkomen met de olieverf in het originele schilderij. Controleer in de preview vooral de aansluitingen en kies eventueel later voor handmatig bijgewerkte beelden.

## Geïntegreerd origineel
`original.jpg` is het originele Commons-detail (917×1059), lokaal gebundeld en vooraf gecachet. Het bevat de Boomman; de sprite-illustraties zijn een vrije reconstructie.
