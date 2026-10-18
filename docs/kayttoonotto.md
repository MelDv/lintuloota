# Käyttöönotto

Tämä ohje vie tyhjästä toimivaan lintulootaan: ensin avaimet, sitten oma kone ja lopuksi julkaisu Azureen. Kaikki palvelut ovat ilmaisia tämän kokoisessa käytössä.

> ⚠️ **Lintuloota ei toimi sellaisenaan.** Repossa ei ole avaimia, tietokantaa eikä julkaisua. Tarvitset omat ilmaiset tilit ja avaimet (eBird, xeno-canto, GeoNames, MaxMind) sekä oman Azure Static Web Appin. Avaimet laitetaan **asetuksiin, ei koodiin**: omalla koneella tiedostoon `api/local.settings.json` (ei mene Gitiin) ja Azuressa sovellusasetuksiin. Tämän repon tekijän avaimia tai palvelua ei voi käyttää.

1. [Avaimet ja tilit](#1-avaimet-ja-tilit)
2. [Kehitysympäristö](#2-kehitysympäristö)
3. [Oma kone](#3-oma-kone)
4. [Julkaisu Azureen](#4-julkaisu-azureen)
5. [Lisääminen omalle sivulle](#5-lisääminen-omalle-sivulle)
6. [Ongelmatilanteet](#6-ongelmatilanteet)

---

## 1. Avaimet ja tilit

Tarvitset neljä ilmaista tiliä omissa nimissäsi. Lue jokaisen palvelun käyttöehdot, sillä hyväksyt ne avainta hakiessasi.

| Palvelu | Mihin | Mistä | Asetuksen nimi |
|---|---|---|---|
| **eBird** | lintuhavainnot | https://ebird.org/api/keygen (vaatii eBird-tilin) | `EBIRD_API_KEY` |
| **xeno-canto** | lintujen äänet | rekisteröidy https://xeno-canto.org, avain on tilin asetuksissa | `XENO_CANTO_API_KEY` |
| **GeoNames** | paikkojen nimet eri kielillä | https://www.geonames.org/login | `GEONAMES_USERNAME` |
| **MaxMind** | sijaintitietokanta | https://www.maxmind.com/en/geolite2/signup | GitHub-salaisuudet, ks. kohta 4 |

**GeoNames:** tili ei vielä riitä. Kirjaudu sisään, avaa tilisi sivu ja napsauta kohdassa *Free Web Services* **"Click here to enable"**. Ilman tätä rajapinta vastaa virheellä.

**MaxMind:** luo tilin jälkeen lisenssiavain kohdassa *Manage License Keys → Generate new license key*. Ota talteen **Account ID** ja **License key**, sillä avain näytetään vain kerran.

> ⚠️ Avaimet ovat salaisuuksia. Älä koskaan laita niitä julkaistavaan kansioon (`widget/`) tai tiedostoon, joka menee Gitiin. Repon `.gitignore` estää valmiiksi `local.settings.json`-tiedoston ja tietokannan.

Jos jokin avain puuttuu, lintuloota toimii suppeammin: ilman GeoNamesia paikkojen nimet tulevat englanniksi, ja ilman xeno-cantoa lintuboksissa ei ole ääntä. eBird-avain ja sijaintitietokanta ovat välttämättömiä.

## 2. Kehitysympäristö

Azure Static Web Appsin funktiot tukevat Node.js-versiota **22** (versio 24 ei vielä toimi). Windowsissa versiota on helpointa hallita nvm-windowsilla:

```powershell
winget install CoreyButler.NVMforWindows
# avaa uusi PowerShell järjestelmänvalvojana
nvm install 22
nvm use 22
node --version          # v22.x

npm install -g azure-functions-core-tools@4 @azure/static-web-apps-cli
func --version          # 4.x
swa --version
```

macOS:llä ja Linuxilla vastaavat työkalut ovat [nvm](https://github.com/nvm-sh/nvm) ja samat `npm install -g` -komennot.

## 3. Oma kone

### 3.1 Koodi ja riippuvuudet

```powershell
git clone https://github.com/MelDv/lintuloota.git
cd lintuloota\api
npm install
```

### 3.2 Asetukset

Kopioi malli ja täytä omat avaimesi:

```powershell
copy local.settings.example.json local.settings.json
```

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "EBIRD_API_KEY": "…",
    "XENO_CANTO_API_KEY": "…",
    "GEONAMES_USERNAME": "…",
    "LINTULOOTA_KIELI": "fi",
    "LINTULOOTA_KIELET": "fi,en",
    "LINTULOOTA_TUNNISTE": "lintuloota/1.0 (https://oma-sivustosi.fi)"
  }
}
```

`LINTULOOTA_KIELI` on lajien, paikkojen ja maiden nimien oletuskieli (esim. `fi`, `sv`, `en`). `LINTULOOTA_KIELET` luettelee kielet, joita sivu saa pyytää. Ks. [asetukset.md](asetukset.md#kieli).

`LINTULOOTA_TUNNISTE` kertoo Wikimedialle, kuka kuvia hakee ([Wikimedian ohje](https://meta.wikimedia.org/wiki/User-Agent_policy)). Laita siihen oma sivustosi tai sähköpostisi.

### 3.3 Sijaintitietokanta

Kirjaudu MaxMindiin ja valitse **Download Databases → GeoLite2 City → Download GZIP**. Pura paketti ja kopioi `GeoLite2-City.mmdb` kansioon `api/data`:

```powershell
tar -xzf GeoLite2-City_*.tar.gz
mkdir data
copy GeoLite2-City_*\GeoLite2-City.mmdb data\
```

Tietokanta on noin 50 Mt. MaxMindin ehtojen mukaan sitä ei saa jakaa eteenpäin, joten se ei kuulu Gitiin eikä julkaistavaan kansioon.

### 3.4 Käynnistys

Repon juuressa:

```powershell
swa start
```

Komento lukee asetukset tiedostosta `swa-cli.config.json`: sivu kansiosta `widget` ja funktiot kansiosta `api`.

Odota, kunnes näkyy `Azure Static Web Apps emulator started at http://localhost:4280`.

| Osoite | Mitä näet |
|---|---|
| http://localhost:4280 | esimerkkisivu ja kaksi lintulootaa |
| http://localhost:4280/api/lintu | lintutieto JSON-muodossa (vaihe 4, koska omalla koneella sijaintia ei tunneta) |
| http://localhost:4280/api/lintu?testi-ip=193.166.3.1 | Helsingin lintu |
| http://localhost:4280/api/lintu?testi-ip=2001:708:10::1 | Espoon lintu (IPv6) |
| http://localhost:4280/api/lintu?testi-ip=193.166.3.1&testi-vaihe=3 | vaihe 3: arvottu laji |

`testi-ip` ja `testi-vaihe` toimivat vain omalla koneella. Azuressa ne ohitetaan, eikä vastauksessa ole `testi`-kenttää.

> 💡 Testaa säästeliäästi. eBird hylkää liian tiheät kyselyt (virhe 429). Välimuisti pitää kyselyt vähissä, mutta jokainen `swa start` tyhjentää sen.

## 4. Julkaisu Azureen

### 4.1 Static Web App

1. Luo oma repo GitHubiin ja vie koodi sinne. Kopioi julkaisuputki paikalleen: `esimerkit/julkaisu.yml` → `.github/workflows/julkaisu.yml`. Tässä repossa putki on vain mallina, jotta sitä ei ajeta ilman avaimia.
2. Avaa [Azure-portaali](https://portal.azure.com) → **Create a resource → Static Web App**:
   - **Plan type:** Free
   - **Region:** lähin EU-alue (tiedot pysyvät EU:ssa)
   - **Deployment details → Source:** **Other**. Repossa on valmis julkaisuputki, joten Azure ei saa luoda omaansa.
3. Kun resurssi on valmis: **Overview → Manage deployment token**, ja kopioi tunnus.

### 4.2 GitHub-salaisuudet

GitHubissa: repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Nimi | Arvo |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | kohdan 4.1 julkaisutunnus |
| `MAXMIND_ACCOUNT_ID` | MaxMind Account ID |
| `MAXMIND_LICENSE_KEY` | MaxMind License key |

### 4.3 Sovellusasetukset

Azure-portaalissa: Static Web App → **Settings → Environment variables** → lisää samat kuin `local.settings.json`-tiedostossa: `EBIRD_API_KEY`, `XENO_CANTO_API_KEY`, `GEONAMES_USERNAME`, `LINTULOOTA_KIELI`, `LINTULOOTA_KIELET` ja `LINTULOOTA_TUNNISTE`. Tallenna **Apply**-napilla.

### 4.4 Julkaisu

Kun olet kopioinut julkaisuputken omaan repoosi (kohta 4.1), se käynnistyy:
- aina, kun `main`-haaraan tulee muutoksia
- kerran kuussa (1. päivä), jotta GeoLite2-tietokanta päivittyy. MaxMindin ehdot vaativat vanhan version vaihtamisen 30 päivän kuluessa.
- käsin: GitHub → **Actions → Julkaisu Azureen → Run workflow**

Ensimmäinen julkaisu: käynnistä putki käsin tai vie muutos `main`-haaraan. Kun putki on vihreä, sivu on osoitteessa, jonka näet Azure-portaalin Overview-sivulta.

Putki lataa GeoLite2-tietokannan MaxMindilta, sijoittaa sen kansioon `api/data` ja julkaisee kansiot `widget` (sivu) ja `api` (funktiot).

## 5. Lisääminen omalle sivulle

Lintuloota tarvitsee taustapalvelun (`api/`), joten helpoin tapa on käyttää sitä sivuston kanssa samassa Azure Static Web Appissa:

1. Kopioi oman sivustosi repoon kansio `api/` (tai sen sisältö olemassa olevaan api-kansioon).
2. Kopioi `widget/lintuloota.js` ja `widget/lintuloota.css` sivustosi kansioon.
3. Lisää sivulle:
   ```html
   <link rel="stylesheet" href="lintuloota.css">
   <div id="lintuloota"></div>
   <script src="lintuloota.js"></script>
   <script>Lintuloota.kaynnista({ elementti: '#lintuloota' });</script>
   ```
4. Lisää sivustosi julkaisuputkeen GeoLite2-latausvaihe (kopioi tiedostosta `esimerkit/julkaisu.yml`) ja aseta `api_location: api`.
5. Lisää sivustosi `staticwebapp.config.json`-tiedostoon `"platform": { "apiRuntime": "node:22" }`.
6. Päivitä tietosuojaseloste: [tietosuoja.md](tietosuoja.md).

Jos sivu ja funktiot ovat eri osoitteissa, aseta `api`-asetus (ks. [asetukset.md](asetukset.md)) ja salli sivusi osoite funktioiden CORS-asetuksissa.

## 6. Ongelmatilanteet

| Oire | Syy ja ratkaisu |
|---|---|
| `Worker runtime cannot be 'None'` | Tiedosto `api/local.settings.json` puuttuu. Kopioi `local.settings.example.json` sen nimiseksi ja täytä avaimet (kohta 3.2). |
| `Found Azure Functions Core Tools v4 which is incompatible with your current Node.js` | Node-versio on liian uusi. Käytä Node 22:ta (`nvm use 22`). |
| Esimerkkisivu ei löydy (404) osoitteesta localhost:4280 | Käynnistä repon juuresta pelkällä `swa start`, jolloin asetukset tulevat tiedostosta `swa-cli.config.json`. Jos annat kansiot itse, muista sivun kansio: `swa start widget --api-location api`. |
| `Unable to access AzureWebJobsStorage` (`swa start` -ikkunassa) | Harmiton. HTTP-funktiot eivät tarvitse tallennustiliä. |
| `eBird 429` lokissa | Liian monta kyselyä lyhyessä ajassa. Odota 15–30 min. Kävijät saavat sillä välin edellisen onnistuneen tuloksen. |
| Lintuboksi näyttää aina satunnaisen paikan | Omalla koneella normaalia. Azuressa: tarkista, että `api/data/GeoLite2-City.mmdb` latautui (julkaisuputken loki). |
| Paikkojen nimet englanniksi | `GEONAMES_USERNAME` puuttuu, tai tilin *Free Web Services* ei ole päällä. Kehityksessä lokiin tulee `GeoNames-haku epäonnistui`. |
| Nimet väärällä kielellä | Sivu ei pyydä kieltä (`kieli`-asetus), tai kieli puuttuu palvelimen `LINTULOOTA_KIELET`-listasta. |
| Ei ääntä | `XENO_CANTO_API_KEY` puuttuu, tai lajista ei ole sopivaa äänitettä (3–15 s, MP3). |
| Muutokset eivät näy omalla koneella | Uusi funktiotiedosto luetaan vain käynnistyksessä: pysäytä `swa` (Ctrl + C) ja käynnistä uudelleen. |

Kehityksessä varoitukset näkyvät `swa start` -ikkunassa muodossa `Vaihe 1 epäonnistui: …`. Azuressa niitä ei kirjoiteta lokiin.
