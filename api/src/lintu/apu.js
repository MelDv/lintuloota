// Yleiset apuvälineet, joita lintuloodan moduulit käyttävät

// true vain omalla koneella (func start / swa start), ei Azuressa
const KEHITYS = process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development';

// Nimien oletuskieli: lajit (eBird), paikat (GeoNames) ja maat. Oletus suomi.
const KIELI = process.env.LINTULOOTA_KIELI || 'fi';

// Kielet, joita sivu voi pyytää kyselyssä (?kieli=en). Oletuksena oletuskieli ja englanti.
// Lista on rajattu, koska jokainen uusi kieli tarkoittaa uusia kyselyitä eBirdiin ja GeoNamesiin.
const KIELET = (process.env.LINTULOOTA_KIELET || `${KIELI},en`)
    .split(',').map(kieli => kieli.trim()).filter(Boolean);

// Pyydetty kieli, jos se on sallittu, muuten oletuskieli
function valitseKieli(pyydetty) {
    return KIELET.includes(pyydetty) ? pyydetty : KIELI;
}

// Ajat millisekunteina
const MINUUTTI = 60 * 1000;
const TUNTI = 60 * MINUUTTI;
const PAIVA = 24 * TUNTI;

// Onko teksti tieteellisen nimen muotoinen (esim. "Corvus cornix" tai "Corvus corone cornix").
// Kuvan ja äänen välitys hyväksyy vain nämä, ettei niitä voi käyttää muuhun.
function onTieteellinenNimi(teksti) {
    return /^[A-Z][a-z]+( [a-z-]+){1,2}$/.test(teksti ?? '');
}

// Kirjoittaa varoituksen lokiin vain kehityksessä. Viesteissä ei saa olla henkilötietoja.
function varoita(viesti, virhe) {
    if (KEHITYS) {
        console.warn(viesti, virhe?.message ?? '');
    }
}

// Arpoo listasta enintään 'maara' eri alkiota
function arvoJoukko(lista, maara) {
    const jaljella = [...lista];       // kopio, ettei alkuperäinen lista muutu
    const valitut = [];
    while (valitut.length < maara && jaljella.length > 0) {
        const i = Math.floor(Math.random() * jaljella.length);
        valitut.push(jaljella.splice(i, 1)[0]);   // otetaan alkio pois listasta, ettei se tule kahdesti
    }
    return valitut;
}

// Arpoo listasta yhden alkion (tai undefined, jos lista on tyhjä)
function arvoYksi(lista) {
    return arvoJoukko(lista, 1)[0];
}

// Ajaa tehtävät erissä: 'kerralla' tehtävää yhtä aikaa, sitten seuraava erä.
// tehtavat: lista funktioita, jotka palauttavat lupauksen (Promise)
async function erissa(tehtavat, kerralla) {
    const tulokset = [];
    for (let i = 0; i < tehtavat.length; i += kerralla) {
        const era = tehtavat.slice(i, i + kerralla).map(tehtava => tehtava());
        tulokset.push(...await Promise.allSettled(era));
    }
    return tulokset;
}

module.exports = { KEHITYS, KIELI, valitseKieli, MINUUTTI, TUNTI, PAIVA, onTieteellinenNimi, varoita, arvoJoukko, arvoYksi, erissa };
