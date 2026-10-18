// Sijainti IP-osoitteesta: MaxMind GeoLite2 (paikallinen tietokanta) ja paikkojen nimet GeoNamesista

const path = require('path');
const maxmind = require('maxmind');
const { varoita } = require('./apu');
const { Valimuisti } = require('./valimuisti');

// Maiden nimet: maanNimi('NL', 'fi') → 'Alankomaat', maanNimi('NL', 'sv') → 'Nederländerna'.
// Kääntäjä luodaan kerran kutakin kieltä kohti.
const maidenNimet = new Map();
function maanNimi(maakoodi, kieli) {
    if (!maidenNimet.has(kieli)) {
        maidenNimet.set(kieli, new Intl.DisplayNames(kieli, { type: 'region' }));
    }
    return maidenNimet.get(kieli).of(maakoodi);
}

// Tietokanta avataan vain kerran: lupaus säilyy pyynnöstä toiseen
let tietokanta = null;
function avaaTietokanta() {
    // __dirname on tämän tiedoston kansio (api/src/lintu), joten noustaan kaksi tasoa
    tietokanta ??= maxmind.open(path.join(__dirname, '..', '..', 'data', 'GeoLite2-City.mmdb'));
    return tietokanta;
}

// Paikkojen nimet: 'kieli:geoname_id' → nimi. Nimet eivät vanhene.
const paikkojenNimet = new Valimuisti();

// Hakee GeoNamesista paikan nimen annetulla kielellä. GeoLite2 käyttää GeoNamesin tunnisteita,
// joten tunniste ja nimi tulevat samasta lähteestä. GeoNamesille lähetetään vain paikan tunniste.
// Palauttaa nimen tai null (virhe tai ei käyttäjätunnusta: käytetään GeoLite2:n nimeä).
async function nimiKielella(geonameId, kieli) {
    if (!geonameId || !process.env.GEONAMES_USERNAME) {
        return null;
    }
    try {
        return await paikkojenNimet.hae(`${kieli}:${geonameId}`, () => haeGeoNamesista(geonameId, kieli), Infinity);
    } catch (virhe) {
        varoita(`GeoNames-haku epäonnistui (${geonameId}):`, virhe);
        return null;
    }
}

async function haeGeoNamesista(geonameId, kieli) {
    // lang: vastauksen 'name' on tällä kielellä, jos nimi on olemassa, muuten paikan oma nimi
    const osoite = `https://secure.geonames.org/getJSON?geonameId=${geonameId}&lang=${kieli}`
        + `&username=${encodeURIComponent(process.env.GEONAMES_USERNAME)}`;
    const vastaus = await fetch(osoite, { signal: AbortSignal.timeout(5000) });   // GeoNames on välillä hidas
    const data = await vastaus.json();
    if (data.status) {
        // GeoNames kertoo virheet (esim. ylittynyt raja) status-kentässä, vaikka vastaus muuten onnistuu
        throw new Error(data.status.message);
    }
    return data.name ?? null;
}

// Varanimen kielijärjestys GeoLite2:n nimistä. Ensin pyydetty kieli, sitten latinalaisin kirjaimin
// kirjoitettavat kielet, koska ne ovat useimmille lukijoille tutuimpia.
const VARAKIELET = ['en', 'de', 'fr', 'es', 'pt-BR'];

// Valitsee GeoLite2:n nimistä parhaan: pyydetty kieli, sitten VARAKIELET
function nimiDatasta(nimet, kieli) {
    if (!nimet) {
        return null;
    }
    for (const k of [kieli, ...VARAKIELET]) {
        if (nimet[k]) {
            return nimet[k];
        }
    }
    return Object.values(nimet)[0] ?? null;   // mikä tahansa jäljellä oleva nimi
}

// Paikan (kaupungin tai maakunnan) nimi: GeoNamesista annetulla kielellä, muuten GeoLite2:n nimistä
async function paikanNimi(osa, kieli) {
    const nimiDatassa = nimiDatasta(osa?.names, kieli);
    if (!nimiDatassa) {
        return null;
    }
    return await nimiKielella(osa.geoname_id, kieli) ?? nimiDatassa;
}

// Palauttaa { kaupunki, maa, ebirdAlue } tai null, jos edes maata ei tiedetä
async function haeSijainti(ip, kieli) {
    if (!ip || !maxmind.validate(ip)) {
        return null;
    }
    let db;
    try {
        db = await avaaTietokanta();
    } catch (virhe) {
        tietokanta = null;                  // seuraava pyyntö yrittää avata uudelleen
        varoita('Sijaintitietokantaa ei saatu auki:', virhe);
        return null;
    }
    const tulos = db.get(ip);
    const maa = tulos?.country?.iso_code;
    if (!maa) {
        return null;
    }
    const maakunta = tulos.subdivisions?.[0];

    // Tarkin tiedossa oleva nimi: kaupunki → maakunta → maa
    const nimi = await paikanNimi(tulos.city, kieli)
        ?? await paikanNimi(maakunta, kieli)
        ?? maanNimi(maa, kieli);

    // eBirdin aluetunnus: maakunta (esim. FI-18), tai maa, jos maakuntaa ei tiedetä
    const ebirdAlue = maakunta?.iso_code ? `${maa}-${maakunta.iso_code}` : maa;

    return { kaupunki: nimi, maa, ebirdAlue };
}

module.exports = { haeSijainti, maanNimi };
