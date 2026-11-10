# LinkedOut

Het netwerk voor wat je echt denkt over werk. Het tegenovergestelde van gepolijste carrièreposts.

## Wat kan versie 1

Vijf soorten posts:

- **Vertrek** – wat je zei bij je afscheid, en wat er echt speelde.
- **Zinloze meeting** – als kassabon: aantal mensen × duur = verspilde mensuren.
- **Mens-review** – over een leidinggevende, collega of klant. Zonder naam, met een cijfer van 1 tot 5.
- **Echt-tip** – wat helpt om echter te zijn op je werk.
- **Bloedirritant** – wat we normaal zijn gaan vinden, en wat je liever ziet.

Verder:

- **Nep-detector** – leest mee terwijl je typt en vertaalt kantoortaal ("even sparren" → overleggen).
- **Reacties** – Herkenbaar, Au, Respect.
- **Schuilnaam** – je post anoniem, bijvoorbeeld als "Vermoeide Planner".
- Filter op soort post, sorteer op nieuwste of meest herkenbaar.
- Teller van verspilde mensuren in de feed.
- Licht en donker thema, werkt op telefoon.

## Starten

Open `index.html` in een browser. Er is geen installatie of build nodig.

## Bestanden

| Bestand | Inhoud |
| --- | --- |
| `index.html` | De pagina |
| `styles.css` | Vormgeving, licht en donker |
| `app.js` | Posten, feed, reacties, nep-detector |
| `seed.js` | Verzonnen voorbeeldposts |

## Bekende grenzen

Dit is een prototype. Posts en reacties staan in de browser van één apparaat (`localStorage`). Niemand anders ziet ze.

Voor een echt netwerk is nog nodig:

1. Een server met een database, zodat posts gedeeld worden.
2. Accounts en moderatie (melden, verwijderen).
3. Juridische check op privacy (AVG) en smaad, vooral voor mens-reviews en bedrijfsnamen.
