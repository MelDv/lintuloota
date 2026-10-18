// Linnun kuva Wikimedia Commonsista: pienennetty kuva sekä tekijä ja lisenssi.
// Kävijän selain ei ota yhteyttä Wikimediaan, vaan kuva välitetään oman funktion (/api/lintukuva) kautta.

const { PAIVA, onTieteellinenNimi, varoita } = require('./apu');
const { Valimuisti } = require('./valimuisti');

const KUVAN_LEVEYS = 120;   // pikseleinä: lintuboksin kuva on 56 px, tarkoilla näytöillä tarvitaan kaksinkertainen
// Wikimedia pyytää kertomaan, kuka kysyy: oma sivusto tai sähköposti asetukseen LINTULOOTA_TUNNISTE
const TUNNISTE = process.env.LINTULOOTA_TUNNISTE || 'lintuloota/1.0';

async function wikimedia(osoite) {
    const vastaus = await fetch(osoite, {
        headers: { 'User-Agent': TUNNISTE },
        signal: AbortSignal.timeout(5000)
    });
    if (!vastaus.ok) {
        throw new Error(`Wikimedia ${vastaus.status}: ${osoite}`);
    }
    return vastaus;
}

// Rajapintojen vastauksissa sivut ovat oliossa, jonka avain on sivun tunniste: otetaan ensimmäinen
function ensimmainenSivu(data) {
    return Object.values(data.query?.pages ?? {})[0];
}

// Commonsin tekijäkentässä on HTML:ää (linkkejä): jätetään vain teksti
function ilmanHtml(teksti) {
    return teksti?.replace(/<[^>]*>/g, '').trim() || null;
}

// Hakee lajin kuvan tiedot: { lahde, tekija, lisenssi, lisenssiUrl } tai null, jos vapaata kuvaa ei ole
async function haeKuvatiedot(tieteellinen) {
    // 1. Wikipedian artikkelin pääkuva. Tieteellinen nimi ohjautuu lajin artikkeliin (redirects=1).
    const artikkeli = await (await wikimedia('https://en.wikipedia.org/w/api.php?action=query&format=json'
        + `&prop=pageimages&piprop=name&redirects=1&titles=${encodeURIComponent(tieteellinen)}`)).json();
    const tiedosto = ensimmainenSivu(artikkeli)?.pageimage;
    if (!tiedosto) {
        return null;
    }

    // 2. Commonsista pienennetty kuva ja tekijätiedot. Ei-vapaat kuvat eivät ole Commonsissa, joten ne jäävät pois.
    const tiedot = await (await wikimedia('https://commons.wikimedia.org/w/api.php?action=query&format=json'
        + `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${KUVAN_LEVEYS}`
        + `&titles=${encodeURIComponent('File:' + tiedosto)}`)).json();
    const info = ensimmainenSivu(tiedot)?.imageinfo?.[0];
    if (!info?.thumburl) {
        return null;
    }
    const metatiedot = info.extmetadata ?? {};
    return {
        lahde: info.thumburl,
        tekija: ilmanHtml(metatiedot.Artist?.value) ?? 'tuntematon tekijä',
        lisenssi: metatiedot.LicenseShortName?.value ?? 'katso lisenssi',
        lisenssiUrl: metatiedot.LicenseUrl?.value ?? info.descriptionurl   // vapaan kuvan sivu Commonsissa
    };
}

// Kuvatiedot muistissa viikon (myös "ei kuvaa"), lajin tieteellisen nimen mukaan
const kuvatiedot = new Valimuisti();
function kuvanTiedot(tieteellinen) {
    return kuvatiedot.hae(tieteellinen, () => haeKuvatiedot(tieteellinen), 7 * PAIVA);
}

// Lintuboksille: { url, tekija, lisenssi, lisenssiUrl } tai null. Virhe ei kaada lintutietoa, kuva vain jää pois.
async function lintuKuva(tieteellinen) {
    if (!onTieteellinenNimi(tieteellinen)) {
        return null;
    }
    try {
        const tiedot = await kuvanTiedot(tieteellinen);
        if (!tiedot) {
            return null;
        }
        const { lahde, ...tekijatiedot } = tiedot;   // Wikimedian osoite jää palvelimelle
        return { url: `/api/lintukuva?laji=${encodeURIComponent(tieteellinen)}`, ...tekijatiedot };
    } catch (virhe) {
        varoita(`Kuvan haku epäonnistui (${tieteellinen}):`, virhe);
        return null;
    }
}

// Välitysfunktiolle: kuvan tavut ja tyyppi, tai null
async function kuvadata(tieteellinen) {
    if (!onTieteellinenNimi(tieteellinen)) {
        return null;
    }
    const tiedot = await kuvanTiedot(tieteellinen);
    if (!tiedot) {
        return null;
    }
    const vastaus = await wikimedia(tiedot.lahde);
    return {
        data: Buffer.from(await vastaus.arrayBuffer()),
        tyyppi: vastaus.headers.get('content-type') ?? 'image/jpeg'
    };
}

module.exports = { lintuKuva, kuvadata };
