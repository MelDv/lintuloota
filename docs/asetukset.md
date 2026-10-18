# Asetukset

Lintulootassa on kahdenlaisia asetuksia:
- **selaimessa:** tekstit, värit ja tapahtumat (`Lintuloota.kaynnista`-funktion asetukset ja CSS-muuttujat)
- **palvelimella:** nimien oletuskieli, sallitut kielet ja avaimet (`local.settings.json` ja Azuren sovellusasetukset)

## Käynnistys

```html
<div id="lintuloota"></div>
<script src="lintuloota.js"></script>
<script>
    const loota = Lintuloota.kaynnista({
        elementti: '#lintuloota',      // valitsin tai elementti (oletus '#lintuloota')
        api: '/api',                   // funktioiden osoite (oletus '/api')
        tekstit: { /* ks. alla */ },   // korvaa oletustekstit
        varalinnut: [ /* SVG-merkkijonoja */ ],   // tai false
        kunValmis: tieto => { /* ks. Tapahtumat */ }
    });
</script>
```

Samalla sivulla voi olla useita lintulootia, kunhan jokaisella on oma elementtinsä.

| Asetus | Oletus | Kuvaus |
|---|---|---|
| `elementti` | `'#lintuloota'` | Elementti, jonka sisälle lintuloota rakennetaan. Valitsin (`'#id'`) tai DOM-elementti. |
| `api` | `'/api'` | Funktioiden osoite. Vaihda, jos funktiot ovat eri osoitteessa (vaatii CORS-asetuksen). |
| `kieli` | palvelimen oletus | Lajien, paikkojen ja maiden nimien kieli, esim. `'en'`. Kielen pitää olla sallittu palvelimella, ks. [Kieli](#kieli). |
| `tekstit` | suomenkieliset | Olio, jonka kentät korvaavat oletustekstit. Riittää antaa muutettavat. |
| `varalinnut` | kolme piirrosta | Lista SVG-merkkijonoja, jotka näytetään latauksen ajan ja kun valokuvaa ei ole. `false` = ei varalintuja. |
| `kunValmis` | – | Funktio, jota kutsutaan, kun lintu on löytynyt. |

## Tekstit

Teksteissä voi käyttää **paikkamerkkejä**, jotka korvataan tiedolla. Lihavoinnit ja kursiivit tulevat automaattisesti.

| Teksti | Oletus | Paikkamerkit |
|---|---|---|
| `nimi` | Lintutietoutta | – (ruudunlukijan nimi boksille) |
| `lataus` | Kiikarit silmille, tuollahan on… | – |
| `vaihe1` | Sinun tai VPN:si sijainti on {sijainti}. Lintu, jota alueellasi on viime päivinä havaittu useimmin, on {laji}! | `{sijainti}` `{laji}` |
| `vaihe2` | Sinun tai VPN:si sijainti on {sijainti}. Lintu, jota alueellasi havaittiin useimmin vuosi sitten tähän aikaan, on {laji}! | `{sijainti}` `{laji}` |
| `vaihe3` | Sinun tai VPN:si sijainti on {sijainti}. Alueellasi ei ole kirjattu lintuhavaintoja hetkeen. Jos lähdet kiikareiden kanssa ulos, eteesi saattaa pyrähtää esimerkiksi {laji}! | `{sijainti}` `{laji}` |
| `vaihe4` | Lintutietoutta: paikassa {paikka} useimmin havaittu lintu on viime päivinä ollut {laji}! | `{paikka}` `{laji}` |
| `kuuntele` | Kuuntele, miltä sen laulu kuulostaa: | – |
| `soita` | Kuuntele, miten {laji} laulaa | `{laji}` (soittonapin nimi ruudunlukijalle) |
| `pysayta` | Pysäytä ääni | – |
| `aaniVirhe` | Ääntä ei voitu ladata | – |
| `lahteet` | Lähteet | – |
| `kuvanLahde` | Kuva: {tekija}, Wikimedia Commons, | `{tekija}`; lisenssilinkki lisätään perään |
| `aanenLahde` | Ääni: {tekija}, xeno-canto {numero}, | `{tekija}` `{numero}`; lisenssilinkki lisätään perään |
| `tuntematonLisenssi` | katso lisenssi | – |

Paikkamerkit:
- `{sijainti}`: kävijän paikka, tarkin tiedossa oleva: kaupunki, maakunta tai maa
- `{laji}`: lajin nimi ja tieteellinen nimi suluissa kursiivilla, esimerkiksi **talitiainen** (*Parus major*). Jos nimeä ei ole sivun kielellä, näytetään vain tieteellinen nimi.
- `{paikka}`: vaiheen 4 maakunta ja maa, esimerkiksi **Waikato (Uusi-Seelanti)**

Esimerkki englanninkielisistä teksteistä: `widget/index.html`.

## Kieli

**Tekstien** kieli asetetaan `tekstit`-asetuksella (yllä). **Lajien, paikkojen ja maiden nimien** kieli tulee palvelimelta:

```json
"LINTULOOTA_KIELI": "fi",
"LINTULOOTA_KIELET": "fi,en,sv"
```

- `LINTULOOTA_KIELI` on oletuskieli. Sitä käytetään, kun sivu ei pyydä kieltä.
- `LINTULOOTA_KIELET` luettelee kielet, joita sivu saa pyytää `kieli`-asetuksella. Oletus: oletuskieli ja englanti. Muut pyynnöt saavat oletuskielen. Lista on rajattu, koska jokainen kieli tarkoittaa omia kyselyitä eBirdiin ja GeoNamesiin.

Monikielisellä sivustolla kukin sivu pyytää omaa kieltään:

```js
Lintuloota.kaynnista({ elementti: '#lintuloota', kieli: 'en', tekstit: { /* englanniksi */ } });
```

Kieli vaikuttaa kolmeen asiaan:
- **lajit:** eBirdin lajiluettelo (`locale`). eBird tukee useita kieliä, esimerkiksi `fi`, `sv`, `en`, `de`, `fr` ja `es`. Jos lajille ei ole nimeä valitulla kielellä, käytetään tieteellistä nimeä.
- **paikat:** GeoNamesin nimet (`lang`). Jos nimeä ei ole valitulla kielellä, käytetään paikan omaa nimeä.
- **maat:** selaimen ja Noden sisäänrakennettu `Intl.DisplayNames`.

Vaiheen 4 satunnainen paikka on kaikille kielille yhteinen. Maakunnan nimi tulee eBirdiltä yhdellä kielellä (yleensä paikallisella tai englanniksi).

## Värit ja koko

Kaikki värit ja koot ovat CSS-muuttujia. Muuta niitä omassa tyylitiedostossasi:

```css
.lintuloota {
    --lintuloota-korostus: #1F3A52;
    --lintuloota-leveys: 380px;
}
```

| Muuttuja | Oletus | Kuvaus |
|---|---|---|
| `--lintuloota-leveys` | `460px` | enimmäisleveys |
| `--lintuloota-fonttikoko` | `15px` | tekstin koko (Lähteet on 0,87-kertainen) |
| `--lintuloota-teksti` | `inherit` | tekstin väri |
| `--lintuloota-himmea` | `#56685C` | lataus- ja lähdetekstin väri |
| `--lintuloota-tausta` | `transparent` | boksin tausta |
| `--lintuloota-reuna` | `#DDE3DE` | reunaviiva |
| `--lintuloota-kuvatausta` | `#F7F0E1` | kuvaympyrän tausta (näkyy varalinnun takana) |
| `--lintuloota-korostus` | `#2C4838` | soittonappi ja kohdistuskehys |
| `--lintuloota-korostusteksti` | `#F7F0E1` | soittonapin kuvake |
| `--lintuloota-pyoristys` | `999px` | kulmien pyöristys (`999px` = kapselimuoto, `16px` = laatikko) |

Muista riittävä kontrasti: tekstin ja taustan kontrastisuhde vähintään 4,5:1 (WCAG AA).

## Tapahtumat

Kun lintu löytyy, lintuloota kertoo sen sivulle kahdella tavalla, joista voit käyttää kumpaa tahansa:

```js
// 1. Asetuksena
Lintuloota.kaynnista({
    kunValmis: tieto => console.log(tieto.laji, tieto.omaAlue)
});

// 2. Tapahtumana (kuplii ylöspäin, joten sitä voi kuunnella myös documentista)
document.addEventListener('lintuloota:valmis', tapahtuma => {
    console.log(tapahtuma.detail.laji);
});
```

`tieto` sisältää `/api/lintu`-vastauksen kentät ([toiminta.md](toiminta.md#rajapinnat)) ja lisäksi:
- `omaAlue`: `true`, jos lintu haettiin kävijän alueelta (vaiheet 1–3), ja `false`, jos se on satunnaisesta paikasta (vaihe 4)

Esimerkki: esterdufva.fi vaihtaa sivun tekstin kysymykseksi *"Miten ylänurkan lintu tietää, missä olet?"* vain, kun `omaAlue` on `true`.

## Palvelimen säädöt

Nämä ovat koodissa vakioina, ja niitä voi muuttaa tarvittaessa:

| Vakio | Tiedosto | Oletus | Kuvaus |
|---|---|---|---|
| `LISTOJA_ENINTAAN` | `api/src/lintu/ebird.js` | 15 | montako tuoretta havaintolistaa lasketaan |
| `LAJEJA_VAHINTAAN` | `api/src/lintu/ebird.js` | 5 | kattavan listan vähimmäislajimäärä |
| `RINNAKKAIN` | `api/src/lintu/ebird.js` | 5 | samanaikaiset eBird-kyselyt |
| `MAAT` | `api/src/lintu/hakuketju.js` | 30 maata | vaiheen 4 satunnaiset maat |
| `HAKUEHDOT` | `api/src/lintu/aani.js` | 3–15 s, laatu A, laulu | äänitteen valinta |
| `KUVAN_LEVEYS` | `api/src/lintu/kuva.js` | 120 | kuvan leveys pikseleinä |
