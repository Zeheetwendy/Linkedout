# LinkedOut

Het netwerk voor wat je echt denkt over werk. Geen advertenties, geen gesponsorde posts, geen algoritme.

Dit is de MVP: een besloten groep die je zelf uitnodigt, met een gedeelde feed.

## Wat kan het

- **Accounts op uitnodiging.** Je kiest een schuilnaam en een wachtwoord. Geen e-mailadres, geen echte naam.
- **Vijf soorten posts.** Vertrek (wat je zei / wat echt was), zinloze meeting (als kassabon), mens-review (zonder naam), echt-tip en bloedirritant.
- **Gedeelde feed.** Nieuwste eerst, of meest herkenbaar. Filter op soort post.
- **Reacties.** Herkenbaar, Au, Respect. Eén keer per persoon.
- **Nep-detector.** Leest mee terwijl je typt en vertaalt kantoortaal.
- **Melden en verwijderen.** Iedereen kan een post melden. De beheerder ziet meldingen en kan posts verwijderen.
- **Account verwijderen.** Haalt ook al je posts en reacties weg.

## Starten

Nodig: Node.js 22.13 of nieuwer. Er zijn geen pakketten om te installeren.

```
npm start
```

Open daarna http://localhost:3000.

Bij de eerste start staat er een uitnodigingscode in de terminal. Daarmee maak je het beheerdersaccount. Nieuwe uitnodigingen maak je daarna in de website zelf, rechts onder "Iemand uitnodigen".

## Testen

```
npm test
```

## Beheer vanaf de opdrachtregel

| Opdracht | Wat het doet |
| --- | --- |
| `npm run invite` | Maakt een uitnodigingscode |
| `node server/cli.js invite --admin` | Maakt een code voor een extra beheerder |
| `node server/cli.js reset <schuilnaam>` | Geeft iemand een tijdelijk wachtwoord |
| `node server/cli.js admin <schuilnaam>` | Maakt iemand beheerder |

## Instellingen

Alles heeft een standaardwaarde. Aanpassen kan met omgevingsvariabelen.

| Variabele | Standaard | Betekenis |
| --- | --- | --- |
| `PORT` | `3000` | Poort van de server |
| `DATA_DIR` | `./data` | Map waar de database staat. Maak hier een back-up van. |
| `TRUST_PROXY` | uit | Zet op `1` als de server achter een proxy van een hostingpartij draait |
| `COOKIE_SECURE` | volgt de verbinding | `1` = inlogcookie alleen via https |
| `COOKIE_SAMESITE` | `Strict` | Alleen aanpassen als je weet waarom |
| `ALLOW_FRAMING` | uit | `1` = de site mag in een frame van een andere site getoond worden |

## Hoe het in elkaar zit

| Map of bestand | Inhoud |
| --- | --- |
| `public/` | De website: pagina, vormgeving, lettertypes |
| `public/schema.js` | Soorten posts en hun velden. Gedeeld door browser en server. |
| `server/app.js` | Alle adressen van de server (`/api/...`) en de toegangsregels |
| `server/store.js` | Alle databasevragen. Het enige bestand met SQL. |
| `server/migrations/` | Het databaseschema, in genummerde stappen |
| `server/auth.js` | Wachtwoorden, sessies, uitnodigingscodes |
| `test/` | Tests van de server |

### Uitbouwen

- **Nieuwe soort post:** voeg hem toe in `public/schema.js` en geef hem een weergave in `renderBody` in `public/app.js`.
- **Nieuwe tabel of kolom:** maak een nieuw bestand in `server/migrations/` (bijv. `002_volgen.sql`). Bestaande bestanden wijzig je niet.
- **Grotere database:** de data staat nu in SQLite, één bestand. Dat is ruim genoeg voor duizenden gebruikers. Overstappen naar bijvoorbeeld Postgres raakt alleen `server/db.js` en `server/store.js`.

## Veiligheid en privacy

- Wachtwoorden worden alleen als scrypt-hash bewaard.
- Het inlogcookie is niet uit te lezen door scripts en wordt niet meegestuurd vanaf andere websites.
- De server controleert elk veld zelf en weigert wijzigingen die niet van de eigen pagina komen.
- Er worden geen e-mailadressen, IP-adressen of volgcookies opgeslagen. Lettertypes staan in het project zelf, er gaan geen verzoeken naar andere partijen.
- Inlogpogingen en het aantal posts per uur zijn begrensd.

## Nog niet gedaan

1. Hosting: de app draait nog nergens online.
2. Volgen van mensen en onderwerpen, met een eigen tijdlijn.
3. Tekstreacties onder een post.
4. Zelf je wachtwoord wijzigen (nu via de beheerder).
5. Privacyverklaring en een juridische check (AVG, smaad) vóór je buiten een vertrouwde groep gaat.
