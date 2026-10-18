// Hakuketju: kokeillaan vaiheita järjestyksessä, kunnes jokin löytää lajin.
//   1. alueen tuoreet havainnot
//   2. alueen havainnot vuosi sitten samana päivänä
//   3. arvottu laji alueen lajilistasta
//   4. satunnainen paikka maailmalta (myös silloin, kun sijaintia ei tiedetä)

const { MINUUTTI, varoita, arvoJoukko, arvoYksi } = require('./apu');
const { Valimuisti } = require('./valimuisti');
const { maanNimi } = require('./sijainti');
const { alueenListat, kattavatListat, useimminHavaittuLaji, arvottuLaji, lajinNimi } = require('./ebird');

// Päivämäärä vuosi sitten eBirdin polun muodossa, esim. '2025/10/18'
function vuosiSitten() {
    const paiva = new Date();
    paiva.setFullYear(paiva.getFullYear() - 1);
    return `${paiva.getFullYear()}/${paiva.getMonth() + 1}/${paiva.getDate()}`;
}

// Vaiheet 1–3: jokainen saa alueen ja palauttaa lajikoodin tai null
const ALUEEN_VAIHEET = [
    { vaihe: 1, hae: alue => useimminHavaittuLaji(alue.ebirdAlue) },
    { vaihe: 2, hae: alue => useimminHavaittuLaji(alue.ebirdAlue, vuosiSitten()) },
    { vaihe: 3, hae: alue => arvottuLaji(alue.ebirdAlue) }
];

// alue: haeSijainti-funktion tulos tai null. kieli: lajien ja maiden nimien kieli.
// alkaen: kehityksen aikana voi ohittaa vaiheita testausta varten.
async function haeLintu(alue, kieli, alkaen = 1) {
    if (alue) {
        for (const { vaihe, hae } of ALUEEN_VAIHEET) {
            if (vaihe < alkaen) {
                continue;
            }
            try {
                const lajikoodi = await hae(alue);
                if (lajikoodi) {
                    const lajitieto = await lajinNimi(lajikoodi, kieli);
                    if (vaihe === 1) {
                        tallennaVaralle(alue, lajikoodi);   // vain vaihe 1: "viime päivinä" pitää paikkansa
                    }
                    return { vaihe, sijainti: alue.kaupunki, ...lajitieto };
                }
            } catch (virhe) {
                varoita(`Vaihe ${vaihe} epäonnistui:`, virhe);   // siirrytään seuraavaan vaiheeseen
            }
        }
    }
    return satunnainenPaikkaKielella(kieli);
}

// ---------- Vaihe 4: satunnainen paikka ----------

// Maat eri puolilta maailmaa, joissa eBirdiin kirjataan paljon havaintoja
const MAAT = ['FI', 'SE', 'NO', 'EE', 'DE', 'NL', 'GB', 'FR', 'ES', 'PT', 'IT', 'PL',
    'US', 'CA', 'MX', 'CR', 'CO', 'EC', 'PE', 'BR', 'AR', 'CL',
    'ZA', 'KE', 'IN', 'TH', 'JP', 'TW', 'AU', 'NZ'];

// Arpoo maan ja sieltä maakunnan, jossa on tuoreita havaintoja. Kokeilee enintään kahta maata.
// Palauttaa kielestä riippumattoman tuloksen { paikka, maakoodi, lajikoodi }: nimet lisätään pyynnön kielellä.
async function satunnainenPaikka() {
    for (const maa of arvoJoukko(MAAT, 2)) {
        try {
            const listat = kattavatListat(await alueenListat(maa)).filter(lista => lista.loc?.subnational1Code);
            const lista = arvoYksi(listat);
            if (!lista) {
                continue;
            }
            const lajikoodi = await useimminHavaittuLaji(lista.loc.subnational1Code);
            if (lajikoodi) {
                // maakunta, ei listan tarkkaa paikkaa (voi olla kotiosoite)
                return { paikka: lista.loc.subnational1Name, maakoodi: maa, lajikoodi };
            }
        } catch (virhe) {
            varoita(`Vaihe 4 epäonnistui (${maa}):`, virhe);
        }
    }
    return null;
}

// Vaiheen 4 tulos on kaikille yhteinen (kielestä riippumatta) ja vaihtuu vartin välein.
// Vanhentunuttakin tulosta käytetään varalla, jos eBird ei vastaa.
const yhteinen = new Valimuisti();
const PAIKKA = 'paikka';

async function satunnainenPaikkaMuistista() {
    const tuore = yhteinen.tuore(PAIKKA);
    if (tuore) {
        return tuore;
    }
    const tulos = await satunnainenPaikka();
    if (tulos) {
        yhteinen.tallenna(PAIKKA, tulos, 15 * MINUUTTI);
        return tulos;
    }
    return yhteinen.viimeisin(PAIKKA) ?? null;   // eBird tukossa: edellinen onnistunut tulos
}

// Vaiheen 4 tulos pyynnön kielellä: maan ja lajin nimet lisätään joka kerta (lajinimet ovat välimuistissa)
async function satunnainenPaikkaKielella(kieli) {
    const tulos = await satunnainenPaikkaMuistista();
    if (!tulos) {
        return null;
    }
    try {
        return {
            vaihe: 4,
            paikka: tulos.paikka,
            maa: maanNimi(tulos.maakoodi, kieli),
            ...(await lajinNimi(tulos.lajikoodi, kieli))
        };
    } catch (virhe) {
        varoita('Vaihe 4: lajinimeä ei saatu:', virhe);   // esim. eBird 429: boksi jää piiloon
        return null;
    }
}

// Tallentaa vaiheen 1 tuloksen varalle vaiheen 4 muodossa, jos varatulosta ei vielä ole.
// Kesto 0 = tulos on heti "vanha", joten se ei syrjäytä oikeaa arvontaa, vaan on vain varalla.
// Paikan nimi jää sen pyynnön kielelle, joka tuloksen tallensi (esim. Helsinki tai Helsingfors).
function tallennaVaralle(alue, lajikoodi) {
    if (!yhteinen.onko(PAIKKA) && alue.maa) {
        yhteinen.tallenna(PAIKKA, { paikka: alue.kaupunki, maakoodi: alue.maa, lajikoodi }, 0);
    }
}

module.exports = { haeLintu };
