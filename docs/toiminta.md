# Toiminta

Tämä ohje kertoo, miten lintuloota toimii sisältä: mistä tieto tulee, miten "useimmin havaittu" lasketaan ja mitä tapahtuu, kun jokin palvelu ei vastaa.

## Kokonaiskuva

```
Selain (lintuloota.js)                 Azure Functions (api/)                    Ulkoiset palvelut
───────────────────────                ───────────────────────────────           ─────────────────
1. latausilmoitus näkyviin
2. GET /api/lintu  ──────────────────▶ IP-osoite otsakkeesta → lyhennys
                                       → GeoLite2 (paikallinen)           ──▶  (ei mitään)
                                       → paikan nimi                      ──▶  GeoNames (vain paikan tunniste)
                                       → hakuketju, vaiheet 1–4           ──▶  eBird (aluetunnus, esim. FI-18)
   teksti näkyviin  ◀──────────────────
3. GET /api/lintumedia?laji=…  ──────▶ kuvan ja äänen tiedot              ──▶  Wikipedia, Commons, xeno-canto
   kuva ja soittonappi ◀──────────────
4. <img src=/api/lintukuva?laji=…> ──▶ kuvan välitys                      ──▶  Commons
5. ▶ /api/lintuaani?laji=…  ─────────▶ äänen välitys                      ──▶  xeno-canto
```

Kävijän selain ottaa yhteyttä vain omiin funktioihin. Ulkoiset palvelut näkevät funktion palvelimen osoitteen, eivät kävijän.

## Sijainti

1. **IP-osoite** luetaan `x-forwarded-for`-otsakkeesta (Azure lisää sen). Mukana voi olla useita osoitteita, porttinumero, hakasulkeita tai IPv4 IPv6:n sisällä. Kaikki nämä käsitellään (`ip.js`).
2. **Lyhennys heti:** IPv4:stä nollataan viimeinen osa (`85.76.12.34` → `85.76.12.0`) ja IPv6:sta säilytetään kolme ensimmäistä ryhmää (`2001:708:10::`). Kaupunki säilyy, mutta yksittäinen liittymä ei.
3. **GeoLite2** antaa lyhennetylle osoitteelle maan, maakunnan ja kaupungin (`sijainti.js`). Tietokanta on palvelimella, joten osoite ei lähde minnekään.
4. **Nimi** valitaan tarkimman tiedon mukaan: kaupunki → maakunta → maa. Nimi haetaan GeoNamesista asetetulla kielellä (GeoLite2 käyttää GeoNamesin tunnisteita), muuten GeoLite2:n omista nimistä.
5. **eBirdin aluetunnus** muodostetaan maasta ja maakunnasta, esim. `FI` + `18` = `FI-18` (Uusimaa). eBird käyttää samoja ISO 3166-2 -tunnuksia.

## Hakuketju

`hakuketju.js` kokeilee vaiheita järjestyksessä, kunnes jokin löytää lajin. Virhe tai tyhjä tulos siirtää seuraavaan vaiheeseen.

| Vaihe | Milloin | Miten |
|---|---|---|
| **1** | sijainti tunnetaan | alueen 15 tuoreinta kattavaa havaintolistaa → useimmin esiintyvä laji |
| **2** | ei tuoreita listoja | sama laskenta vuoden takaisen päivän listoista |
| **3** | ei vuoden takaisiakaan | arvottu laji alueen kaikkien aikojen lajilistasta (myös harvinaisuudet) |
| **4** | sijaintia ei tunneta tai kaikki muu epäonnistui | arvottu maa → arvottu kattava lista → sen maakunnan yleisin laji |

### "Useimmin havaittu"

eBirdin tuoreiden havaintojen haku palauttaa jokaisesta lajista vain viimeisimmän havainnon, joten siitä ei näe yleisyyttä. Lintuloota laskee yleisyyden samoin kuin eBird itse, eli **havaintolistoista**:

1. Haetaan alueen 50 tuoreinta listaa (`product/lists`).
2. Valitaan niistä 15 tuoreinta **kattavaa** listaa, joissa on vähintään 5 lajia. Yhden linnun satunnaishavainnot vääristäisivät tulosta, koska ihmiset ilmoittavat niitä erityisesti harvinaisuuksista.
3. Haetaan listojen sisällöt viisi kerrallaan (`product/checklist/view`), koska eBird hylkää liian tiheät kyselyt.
4. Lasketaan, **monellako listalla** kukin laji esiintyy. Yksilömääriä ei lasketa.
5. Kymmenestä yleisimmästä koodista tarkistetaan lajiluettelosta oikeat lajit. Pois jäävät epävarmat määritykset, kuten "lokki sp.", ja risteymät.

### Lajinimet

Lajinimi haetaan eBirdin lajiluettelosta pyydetyllä kielellä (`?kieli=`, ks. [asetukset.md](asetukset.md#kieli)) ja englanniksi. Jos nimet ovat samat, käännöstä ei ole (eBird palauttaa silloin englanninkielisen nimen), ja näytetään tieteellinen nimi.

## Kuva ja ääni

**Kuva** (`kuva.js`):
1. Wikipedian lajiartikkelin pääkuva tieteellisellä nimellä (`prop=pageimages`).
2. Commonsista 120 px:n kuva sekä tekijä ja lisenssi (`prop=imageinfo`). Vain Commonsissa olevat, eli vapaasti lisensoidut, kuvat kelpaavat.

**Ääni** (`aani.js`), xeno-canto API v3, hakuehdot paremmuusjärjestyksessä:
1. `sp:"Parus major" q:A len:3-15 type:song`: laadukas laulu, 3–15 sekuntia
2. ilman `type:song`-ehtoa, sillä kaikilla lajeilla ei ole laulua (esim. varis)
3. ilman laatuehtoa

Vain MP3-tiedostot kelpaavat (WAV voi olla kymmenen kertaa suurempi), eikä suojattuja nauhoituksia oteta mukaan.

Kumpikin välitetään oman funktion kautta (`/api/lintukuva`, `/api/lintuaani`). Välitys hyväksyy vain tieteellisen nimen muotoisen arvon, joten sitä ei voi käyttää muiden osoitteiden hakemiseen (SSRF-suojaus).

## Välimuistit

Kaikki tulokset ovat muistissa (`Valimuisti`-luokka). Muisti tyhjenee, kun funktio menee lepoon (Azuressa noin 20 minuutin käyttämättömyyden jälkeen).

| Mitä | Kesto | Avain |
|---|---|---|
| Alueen yleisin laji | 24 h (1 h, jos havaintoja ei ollut) | aluetunnus (+ päivä vaiheessa 2) |
| Alueen lajilista (vaihe 3) | 7 päivää | aluetunnus |
| Vaiheen 4 satunnainen paikka | 15 min, **yhteinen kaikille kävijöille** | – |
| Lajinimet | pysyvästi | kieli + lajikoodi |
| Paikkojen nimet | pysyvästi | kieli + GeoNames-tunniste |
| Kuvan ja äänen tiedot | 7 päivää | tieteellinen nimi |
| Kuva ja ääni selaimessa | 7 päivää (`Cache-Control`) | osoite |

Virheitä ei tallenneta muistiin, joten seuraava pyyntö yrittää uudelleen.

**Varatulos:** jos eBird ei vastaa (esim. 429), vaihe 4 palauttaa edellisen onnistuneen tuloksen. Ensimmäinen onnistunut vaiheen 1 tulos tallennetaan varalle vaiheen 4 muodossa ("paikassa Helsinki (Suomi)…"), koska kävijän sijaintia koskeva teksti ei pitäisi paikkaansa toiselle kävijälle.

## Rajapinnat

### `GET /api/lintu`

```json
{
  "vaihe": 1,
  "sijainti": "Helsinki",
  "laji": "talitiainen",
  "tieteellinen": "Parus major",
  "latinaksi": false
}
```

| Kenttä | Kuvaus |
|---|---|
| `vaihe` | 1–4, ks. hakuketju |
| `sijainti` | kävijän paikka (vaiheet 1–3) |
| `paikka`, `maa` | satunnaisen paikan maakunta ja maa (vaihe 4) |
| `laji` | lajin nimi pyydetyllä kielellä, tai tieteellinen nimi |
| `tieteellinen` | tieteellinen nimi |
| `latinaksi` | `true`, jos `laji` on tieteellinen nimi |

Tyhjä olio `{}` tarkoittaa, ettei lintua löytynyt.

Parametri `?kieli=en` valitsee nimien kielen, jos se on palvelimen `LINTULOOTA_KIELET`-listassa. Muuten käytetään oletuskieltä (`LINTULOOTA_KIELI`).

Kehityksessä: `?testi-ip=193.166.3.1` (keksitty IP-osoite) ja `?testi-vaihe=3` (aloita vaiheesta 3). Vastauksessa on silloin myös `testi`-kenttä, joka sisältää sijainnin.

### `GET /api/lintumedia?laji=Parus%20major`

```json
{
  "kuva": { "url": "/api/lintukuva?laji=Parus%20major", "tekija": "…", "lisenssi": "CC BY 2.0", "lisenssiUrl": "…" },
  "aani": { "url": "/api/lintuaani?laji=Parus%20major", "aanittaja": "…", "numero": "XC1092333", "lisenssi": "CC BY-NC-SA 4.0", "lisenssiUrl": "…" }
}
```

Kumpi tahansa voi puuttua, jos kuvaa tai ääntä ei löydy.

### `GET /api/lintukuva?laji=…` ja `GET /api/lintuaani?laji=…`

Kuva (JPEG/PNG) tai ääni (MP3). 404, jos ei löydy, ja 502, jos lähdepalvelu ei vastaa.

## Moduulit

```
api/src/
├── functions/                 HTTP-funktiot (Azure lataa kaikki tämän kansion tiedostot)
│   ├── lintu.js               /api/lintu
│   ├── lintumedia.js          /api/lintumedia
│   ├── lintukuva.js           /api/lintukuva
│   └── lintuaani.js           /api/lintuaani
└── lintu/                     moduulit (eivät ole itse funktioita)
    ├── apu.js                 KEHITYS, KIELI, valitseKieli, ajat, varoita, arvonta, erissa
    ├── valimuisti.js          Valimuisti-luokka
    ├── ip.js                  IP-osoitteen luku ja lyhennys
    ├── sijainti.js            GeoLite2 + GeoNames
    ├── ebird.js               eBird-kyselyt ja laskenta
    ├── hakuketju.js           vaiheet 1–4 ja varatulos
    ├── kuva.js                Wikipedia + Commons
    └── aani.js                xeno-canto
```

Moduulit ovat CommonJS-muotoisia (`require` / `module.exports`), kuten Azure Functionsin Node-mallipohjat.
