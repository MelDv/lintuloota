// eBird-kyselyt: alueen yleisin laji, arvottu laji ja lajinimet. Kaikki tulokset välimuistissa.
// eBird-rajapinta: https://documenter.getpostman.com/view/664302/S1ENwy59

const { PAIVA, TUNTI, erissa, arvoJoukko, arvoYksi } = require('./apu');
const { Valimuisti } = require('./valimuisti');

const LISTOJA_ENINTAAN = 15;       // montako tuoretta listaa lasketaan
const LAJEJA_VAHINTAAN = 5;        // kattava lista: vähintään näin monta lajia (ei satunnaishavaintoja)
const RINNAKKAIN = 5;              // montako kyselyä yhtä aikaa (eBird hylkää liian tiheät: virhe 429)

// Kaikki eBird-kyselyt tämän kautta. Avain tulee local.settings.json-tiedostosta (Azuressa sovellusasetuksista).
async function ebird(polku) {
    const vastaus = await fetch(`https://api.ebird.org/v2/${polku}`, {
        headers: { 'X-eBirdApiToken': process.env.EBIRD_API_KEY },
        signal: AbortSignal.timeout(5000)
    });
    if (!vastaus.ok) {
        throw new Error(`eBird ${vastaus.status}: ${polku}`);
    }
    return vastaus.json();
}

// Kattavat havaintolistat: vähintään LAJEJA_VAHINTAAN lajia, ei yhden linnun satunnaishavaintoja
function kattavatListat(listat) {
    return listat.filter(lista => lista.numSpecies >= LAJEJA_VAHINTAAN);
}

// Alueen havaintolistat: tuoreimmat, tai tietyn päivän (paiva esim. '2025/10/18')
async function alueenListat(ebirdAlue, paiva = null) {
    const polku = paiva ? `${ebirdAlue}/${paiva}` : ebirdAlue;
    return ebird(`product/lists/${polku}?maxResults=50`);
}

// Palauttaa ne lajikoodit, jotka ovat oikeita lajeja (ei epävarmoja määrityksiä kuten
// "lokki sp." eikä risteymiä). Järjestys: lajiluettelon järjestys.
async function oikeatLajit(lajikoodit) {
    if (lajikoodit.length === 0) {
        return [];
    }
    const lajit = await ebird(`ref/taxonomy/ebird?species=${lajikoodit.join(',')}&cat=species&fmt=json`);
    return lajit.map(laji => laji.speciesCode);
}

// Laskee, mikä oikea laji esiintyy useimmalla alueen kattavista havaintolistoista.
// Palauttaa lajikoodin (esim. 'eurmag1') tai null.
async function laskeYleisinLaji(ebirdAlue, paiva) {
    const kattavat = kattavatListat(await alueenListat(ebirdAlue, paiva)).slice(0, LISTOJA_ENINTAAN);
    if (kattavat.length === 0) {
        return null;
    }
    const tulokset = await erissa(
        kattavat.map(lista => () => ebird(`product/checklist/view/${lista.subId}`)),
        RINNAKKAIN
    );
    const onnistuneet = tulokset.filter(tulos => tulos.status === 'fulfilled');
    if (onnistuneet.length === 0) {
        // Kaikki haut epäonnistuivat: virhe eikä tyhjä alue, joten tulosta ei tallenneta välimuistiin
        throw new Error(`Kaikki ${tulokset.length} listan hakua epäonnistuivat: ${tulokset[0].reason?.message}`);
    }

    // Monellako listalla kukin laji esiintyy (Set: sama laji samalla listalla vain kerran)
    const laskuri = new Map();
    for (const { value: lista } of onnistuneet) {
        for (const laji of new Set(lista.obs.map(havainto => havainto.speciesCode))) {
            laskuri.set(laji, (laskuri.get(laji) ?? 0) + 1);
        }
    }

    // Kymmenen yleisintä koodia, ja niistä yleisin oikea laji
    const karki = [...laskuri].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([laji]) => laji);
    const oikeat = new Set(await oikeatLajit(karki));
    return karki.find(laji => oikeat.has(laji)) ?? null;
}

// Alueen yleisin laji muistissa: 24 h, tai 1 h, jos havaintoja ei löytynyt
const yleisimmat = new Valimuisti();
function useimminHavaittuLaji(ebirdAlue, paiva = null) {
    const avain = paiva ? `${ebirdAlue}/${paiva}` : ebirdAlue;
    return yleisimmat.hae(avain, () => laskeYleisinLaji(ebirdAlue, paiva),
        lajikoodi => lajikoodi ? PAIVA : TUNTI);
}

// Alueen kaikkien aikojen lajilista muistissa viikon (muuttuu hitaasti)
const lajilistat = new Valimuisti();
function alueenLajit(ebirdAlue) {
    return lajilistat.hae(ebirdAlue, () => ebird(`product/spplist/${ebirdAlue}`), 7 * PAIVA);
}

// Arpoo alueen lajilistasta oikean lajin (harvinaisuudet mukana tarkoituksella)
async function arvottuLaji(ebirdAlue) {
    const ehdokkaat = arvoJoukko(await alueenLajit(ebirdAlue), 20);
    // Lajiluettelo palauttaa oikeat lajit järjestelmällisessä järjestyksessä, joten arvotaan niistä uudelleen
    return arvoYksi(await oikeatLajit(ehdokkaat)) ?? null;
}

// Lajinimet muistissa pysyvästi: 'kieli:lajikoodi' → { laji, tieteellinen, latinaksi }
const lajinimet = new Valimuisti();

// Lajin nimi annetulla kielellä ja tieteellinen nimi.
// Jos nimeä ei ole annetulla kielellä, eBird palauttaa englanninkielisen nimen: silloin
// näytettäväksi nimeksi tulee tieteellinen nimi. Englanninkielisellä sivulla vertailua ei tarvita.
function lajinNimi(lajikoodi, kieli) {
    return lajinimet.hae(`${kieli}:${lajikoodi}`, async () => {
        const kielet = kieli === 'en' ? ['en'] : [kieli, 'en'];
        const [[omalla], [englanniksi] = [omalla]] = await Promise.all(
            kielet.map(k => ebird(`ref/taxonomy/ebird?species=${lajikoodi}&locale=${k}&fmt=json`))
        );
        if (!omalla || !englanniksi) {
            throw new Error(`Tuntematon lajikoodi: ${lajikoodi}`);
        }
        const kaannetty = kieli === 'en' || omalla.comName !== englanniksi.comName;
        return kaannetty
            ? { laji: omalla.comName, tieteellinen: omalla.sciName, latinaksi: false }
            : { laji: omalla.sciName, tieteellinen: omalla.sciName, latinaksi: true };
    }, Infinity);
}

module.exports = { alueenListat, kattavatListat, useimminHavaittuLaji, arvottuLaji, lajinNimi };
