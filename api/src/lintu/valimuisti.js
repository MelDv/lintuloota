// Välimuisti, jonka tiedot vanhenevat. Muisti säilyy pyynnöstä toiseen niin kauan kuin funktio on hereillä.

class Valimuisti {
    #tiedot = new Map();   // avain → { arvo, vanhenee }

    // Tuore arvo tai undefined, jos arvoa ei ole tai se on vanhentunut
    tuore(avain) {
        const tieto = this.#tiedot.get(avain);
        return tieto && tieto.vanhenee > Date.now() ? tieto.arvo : undefined;
    }

    // Viimeisin tallennettu arvo, vaikka se olisi vanhentunut (käytetään varalla)
    viimeisin(avain) {
        return this.#tiedot.get(avain)?.arvo;
    }

    // kesto millisekunteina. Infinity = ei vanhene. 0 = heti vanha, eli vain varalla.
    tallenna(avain, arvo, kesto) {
        this.#tiedot.set(avain, { arvo, vanhenee: Date.now() + kesto });
    }

    onko(avain) {
        return this.#tiedot.has(avain);
    }

    // Palauttaa tuoreen arvon muistista tai hakee sen hakufunktiolla ja tallentaa.
    // kesto: luku tai funktio, joka saa haetun arvon ja palauttaa keston (esim. tyhjälle lyhyempi).
    // Jos haku heittää virheen, mitään ei tallenneta, joten seuraava kutsu yrittää uudelleen.
    async hae(avain, haku, kesto) {
        const muistissa = this.tuore(avain);
        if (muistissa !== undefined) {
            return muistissa;
        }
        const arvo = await haku();
        this.tallenna(avain, arvo, typeof kesto === 'function' ? kesto(arvo) : kesto);
        return arvo;
    }
}

module.exports = { Valimuisti };
