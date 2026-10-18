# Tietosuoja

Lintuloota on suunniteltu niin, ettei se tallenna kävijöistä mitään eikä anna kävijöiden tietoja kolmansille osapuolille. Tämä ohje kertoo tarkasti, mitä tietoja käsitellään, ja antaa valmiin tekstin sivustosi tietosuojaselosteeseen.

> Tämä ei ole oikeudellista neuvontaa. Tarkista oman sivustosi kokonaisuus, kuten muut palvelut ja evästeet.

## Mitä tietoja käsitellään

| Tieto | Missä | Lähteekö muualle? | Tallennetaanko? |
|---|---|---|---|
| Kävijän IP-osoite | funktio lukee sen pyynnöstä ja lyhentää heti | **ei** | **ei** |
| Lyhennetty IP-osoite | haku paikallisesta GeoLite2-tietokannasta | **ei** | **ei** |
| Kävijän alue (esim. Uusimaa, FI-18) | eBird-kyselyissä | eBirdille aluetunnus | välimuistissa tulos alueittain, ei kävijän tietoja |
| Paikan tunniste (GeoNames ID) | paikan nimen haku | GeoNamesille | välimuistissa nimi, ei kävijän tietoja |
| Lajin tieteellinen nimi | kuvan ja äänen haku | Wikipedia, Commons, xeno-canto | välimuistissa |
| Varalinnun vuoro | kävijän selain (`localStorage`) | **ei** | vain kävijän omassa selaimessa |

Kävijän selain ottaa yhteyttä **vain sivuston omaan osoitteeseen**. Kuva ja ääni välitetään funktion kautta, joten Wikimedia ja xeno-canto eivät näe kävijää.

Lintuloota ei käytä evästeitä. Kehityksessä varoitukset kirjoitetaan lokiin, mutta niissä ei ole IP-osoitteita eikä muita henkilötietoja. Azuressa varoituksia ei kirjoiteta.

**Huomaa Azure itse:** Azure Static Web Apps -palvelun lokit voivat sisältää IP-osoitteita palvelun omista syistä (esim. tietoturva). Ne kuuluvat sivustosi tietosuojaselosteeseen palvelimen lokitietoina riippumatta lintulootasta.

## Teksti tietosuojaselosteeseen

Muokkaa tarvittaessa omaan sävyysi:

> **Lintutieto.** Etusivun lintutietoa varten kävijän IP-osoitteesta päätellään karkea sijainti (kaupunki tai maakunta) palvelimella olevan MaxMind GeoLite2 -tietokannan avulla. IP-osoite lyhennetään ennen käsittelyä, eikä sitä tai sijaintia tallenneta. Lintuhavaintoja haetaan eBirdistä (Cornell Lab of Ornithology), jolle välitetään vain alueen tunnus, ja paikan nimi GeoNamesista, jolle välitetään vain paikan tunniste. Linnun kuva (Wikimedia Commons) ja ääni (xeno-canto) välitetään sivuston oman palvelimen kautta, joten nämä palvelut eivät näe kävijän tietoja. Peruste: oikeutettu etu (sivuston toiminta).

## Lisenssit ja lähteiden mainitseminen

- **MaxMind GeoLite2:** lähde on mainittava sivustolla, esimerkiksi tietosuojaselosteessa tai sivun alaosassa: *This product includes GeoLite2 Data created by MaxMind, available from https://www.maxmind.com.*
- **Kuvat ja äänet:** lintuloota näyttää tekijät ja lisenssit Lähteet-kohdassa automaattisesti. Älä piilota sitä, koska Creative Commons -lisenssit edellyttävät tekijän mainitsemista.
- **xeno-canto:** monet äänitteet on lisensoitu ei-kaupallisesti (NC). Jos sivustosi on kaupallinen, tarkista lisenssit tai rajaa haku (ks. `HAKUEHDOT`, [asetukset.md](asetukset.md#palvelimen-säädöt)).
