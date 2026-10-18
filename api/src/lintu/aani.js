// Linnun ääni xeno-cantosta: lyhyt laadukas nauhoitus sekä äänittäjä, numero ja lisenssi.
// Kävijän selain ei ota yhteyttä xeno-cantoon, vaan ääni välitetään oman funktion (/api/lintuaani) kautta.

const { PAIVA, onTieteellinenNimi, varoita } = require('./apu');
const { Valimuisti } = require('./valimuisti');

// Hakuehdot paremmuusjärjestyksessä: ensin laadukas laulu, sitten mikä tahansa laadukas ääni, lopuksi mikä tahansa.
// len:3-15 = 3–15 sekuntia: riittää näytteeksi, ja tiedosto pysyy pienenä.
const HAKUEHDOT = ['q:A len:3-15 type:song', 'q:A len:3-15', 'len:3-15'];

async function xenoCanto(osoite) {
    const vastaus = await fetch(osoite, { signal: AbortSignal.timeout(8000) });
    if (!vastaus.ok) {
        throw new Error(`xeno-canto ${vastaus.status}`);
    }
    return vastaus;
}

// "https://creativecommons.org/licenses/by-nc-sa/4.0/" → "CC BY-NC-SA 4.0"
// "https://creativecommons.org/publicdomain/zero/1.0/" → "CC0 1.0" (vapaa käyttö)
function lisenssinNimi(osoite) {
    const osat = osoite?.match(/licenses\/([a-z-]+)\/([\d.]+)/);
    if (osat) {
        return `CC ${osat[1].toUpperCase()} ${osat[2]}`;
    }
    const cc0 = osoite?.match(/publicdomain\/zero\/([\d.]+)/);
    return cc0 ? `CC0 ${cc0[1]}` : 'katso lisenssi';
}

// Hakee lajin äänen tiedot: { lahde, aanittaja, numero, lisenssi, lisenssiUrl } tai null
async function haeAanitiedot(tieteellinen) {
    for (const ehdot of HAKUEHDOT) {
        const kysely = `sp:"${tieteellinen}" ${ehdot}`;
        const osoite = `https://xeno-canto.org/api/3/recordings?query=${encodeURIComponent(kysely)}`
            + `&key=${encodeURIComponent(process.env.XENO_CANTO_API_KEY)}`;
        const data = await (await xenoCanto(osoite)).json();
        // Vain MP3-tiedostot (pakkaamaton WAV voi olla kymmenen kertaa suurempi).
        // Suojattujen (uhanalaisten) lajien nauhoituksia ei voi ladata: niillä ei ole tiedostoa.
        const nauhoitus = data.recordings?.find(n => n.file && n['file-name']?.toLowerCase().endsWith('.mp3'));
        if (nauhoitus) {
            return {
                lahde: nauhoitus.file,
                aanittaja: nauhoitus.rec,
                numero: `XC${nauhoitus.id}`,
                lisenssi: lisenssinNimi(nauhoitus.lic),
                lisenssiUrl: nauhoitus.lic?.startsWith('//') ? `https:${nauhoitus.lic}` : nauhoitus.lic
            };
        }
    }
    return null;
}

// Äänitiedot muistissa viikon (myös "ei ääntä"), lajin tieteellisen nimen mukaan
const aanitiedot = new Valimuisti();
function aanenTiedot(tieteellinen) {
    return aanitiedot.hae(tieteellinen, () => haeAanitiedot(tieteellinen), 7 * PAIVA);
}

// Lintuboksille: { url, aanittaja, numero, lisenssi, lisenssiUrl } tai null. Virhe ei kaada lintutietoa.
async function lintuAani(tieteellinen) {
    if (!onTieteellinenNimi(tieteellinen) || !process.env.XENO_CANTO_API_KEY) {
        return null;
    }
    try {
        const tiedot = await aanenTiedot(tieteellinen);
        if (!tiedot) {
            return null;
        }
        const { lahde, ...tekijatiedot } = tiedot;   // xeno-canton osoite jää palvelimelle
        return { url: `/api/lintuaani?laji=${encodeURIComponent(tieteellinen)}`, ...tekijatiedot };
    } catch (virhe) {
        varoita(`Äänen haku epäonnistui (${tieteellinen}):`, virhe);
        return null;
    }
}

// Välitysfunktiolle: äänen tavut ja tyyppi, tai null
async function aanidata(tieteellinen) {
    if (!onTieteellinenNimi(tieteellinen) || !process.env.XENO_CANTO_API_KEY) {
        return null;
    }
    const tiedot = await aanenTiedot(tieteellinen);
    if (!tiedot) {
        return null;
    }
    const vastaus = await xenoCanto(tiedot.lahde);
    return {
        data: Buffer.from(await vastaus.arrayBuffer()),
        tyyppi: vastaus.headers.get('content-type') ?? 'audio/mpeg'
    };
}

module.exports = { lintuAani, aanidata };
