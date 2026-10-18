/*!
 * Lintuloota – lintutieto kävijän alueelta
 * https://github.com/MelDv/lintuloota · MIT-lisenssi
 *
 * Käyttö:
 *   <div id="lintuloota"></div>
 *   <script src="lintuloota.js"></script>
 *   <script>Lintuloota.kaynnista({ elementti: '#lintuloota' });</script>
 *
 * Kaikki asetukset: docs/asetukset.md
 */
(function () {
    'use strict';

    // ---------- Oletusasetukset ----------

    // Tekstien paikkamerkit: {sijainti} kävijän paikka, {laji} lajin nimi (ja tieteellinen nimi suluissa),
    // {paikka} vaiheen 4 paikka ja maa, {tekija} kuvaaja/äänittäjä, {numero} xeno-canton tunnus.
    const OLETUSTEKSTIT = {
        nimi: 'Lintutietoutta',
        lataus: 'Kiikarit silmille, tuollahan on…',
        vaihe1: 'Sinun tai VPN:si sijainti on {sijainti}. Lintu, jota alueellasi on viime päivinä havaittu useimmin, on {laji}!',
        vaihe2: 'Sinun tai VPN:si sijainti on {sijainti}. Lintu, jota alueellasi havaittiin useimmin vuosi sitten tähän aikaan, on {laji}!',
        vaihe3: 'Sinun tai VPN:si sijainti on {sijainti}. Alueellasi ei ole kirjattu lintuhavaintoja hetkeen. Jos lähdet kiikareiden kanssa ulos, eteesi saattaa pyrähtää esimerkiksi {laji}!',
        vaihe4: 'Lintutietoutta: paikassa {paikka} useimmin havaittu lintu on viime päivinä ollut {laji}!',
        kuuntele: 'Kuuntele, miltä sen laulu kuulostaa:',
        soita: 'Kuuntele, miten {laji} laulaa',
        pysayta: 'Pysäytä ääni',
        aaniVirhe: 'Ääntä ei voitu ladata',
        lahteet: 'Lähteet',
        kuvanLahde: 'Kuva: {tekija}, Wikimedia Commons, ',
        aanenLahde: 'Ääni: {tekija}, xeno-canto {numero}, ',
        tuntematonLisenssi: 'katso lisenssi'
    };

    // Piirretyt varalinnut: näytetään latauksen ajan ja silloin, kun valokuvaa ei ole.
    // Ne ovat koristeita (aria-hidden), koska piirros ei esitä tekstissä mainittua lajia.
    const OLETUSVARALINNUT = [
        // Talitiainen
        '<svg viewBox="0 0 120 100" aria-hidden="true" focusable="false"><ellipse cx="54" cy="60" rx="34" ry="26" fill="#E9B44C"/><path d="M26 54 C34 36 60 34 74 44 L60 72 C46 74 30 68 26 54 Z" fill="#56685C"/><rect x="68" y="50" width="7" height="32" rx="3.5" fill="#1D3127"/><circle cx="82" cy="38" r="18" fill="#1D3127"/><ellipse cx="86" cy="43" rx="9" ry="7" fill="#FFFFFF"/><path d="M99 35 L108 38 L99 41 Z" fill="#1D3127"/></svg>',
        // Kuukkeli
        '<svg viewBox="0 0 120 100" aria-hidden="true" focusable="false"><ellipse cx="54" cy="60" rx="34" ry="26" fill="#C9A27A"/><path d="M26 54 C34 36 60 34 74 44 L60 72 C46 74 30 68 26 54 Z" fill="#6E6A63"/><circle cx="82" cy="40" r="18" fill="#8C8070"/><path d="M68 30 C74 22 90 22 96 30 L90 34 C84 30 76 30 70 34 Z" fill="#3D3A36"/><circle cx="88" cy="37" r="2.6" fill="#1D3127"/><path d="M99 39 L108 42 L99 45 Z" fill="#1D3127"/></svg>',
        // Harmaahaikara
        '<svg viewBox="0 0 150 130" aria-hidden="true" focusable="false"><path d="M58 44 C50 26 62 12 78 14" fill="none" stroke="#8A9399" stroke-width="10" stroke-linecap="round"/><circle cx="82" cy="14" r="8" fill="#C9CED1"/><path d="M89 16 L120 18 L89 20 Z" fill="#E9B44C"/><ellipse cx="60" cy="64" rx="32" ry="20" fill="#8A9399"/><path d="M32 62 C46 54 72 54 92 66 L72 78 C56 80 40 74 32 62 Z" fill="#56685C"/><path d="M52 82 L48 124 M66 82 L70 124" stroke="#56685C" stroke-width="3" stroke-linecap="round"/></svg>'
    ];

    const SOITA_IKONI = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
    const TAUKO_IKONI = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';

    // ---------- Apufunktiot ----------

    function luo(tagi, luokka, teksti) {
        const el = document.createElement(tagi);
        if (luokka) el.className = luokka;
        if (teksti !== undefined) el.textContent = teksti;
        return el;
    }

    // Korvaa paikkamerkit pelkällä tekstillä (esim. napin nimi ruudunlukijalle)
    function tayta(pohja, arvot) {
        return pohja.replace(/\{(\w+)\}/g, (koko, nimi) => arvot[nimi] ?? koko);
    }

    // Korvaa paikkamerkit elementeillä (lihavointi, kursiivi). Ei innerHTML:ää ulkoiselle datalle.
    function taytaElementeilla(kohde, pohja, osat) {
        for (const pala of pohja.split(/(\{\w+\})/)) {
            const nimi = pala.match(/^\{(\w+)\}$/)?.[1];
            if (nimi && osat[nimi]) {
                kohde.append(...osat[nimi]);
            } else if (pala) {
                kohde.append(pala);
            }
        }
    }

    function lihava(teksti, kursiivi) {
        const strong = luo('strong');
        strong.append(kursiivi ? luo('em', null, teksti) : teksti);
        return strong;
    }

    // Lisenssin osoite tulee Wikimedialta tai xeno-cantolta: linkiksi vain http(s)-osoite,
    // ettei esimerkiksi "javascript:"-osoite päädy sivulle. Muuten pelkkä teksti.
    function onVerkkoOsoite(osoite) {
        try {
            return ['https:', 'http:'].includes(new URL(osoite).protocol);
        } catch (e) {
            return false;   // ei kelvollinen osoite
        }
    }

    function linkki(teksti, osoite) {
        if (!onVerkkoOsoite(osoite)) return document.createTextNode(teksti);
        const a = luo('a', null, teksti);
        a.href = osoite;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        return a;
    }

    async function haeJSON(osoite) {
        const vastaus = await fetch(osoite);
        if (!vastaus.ok) throw new Error(`${osoite}: ${vastaus.status}`);
        return vastaus.json();
    }

    // ---------- Lintuloota ----------

    class Lintuloota {
        constructor(asetukset) {
            const kohde = typeof asetukset.elementti === 'string'
                ? document.querySelector(asetukset.elementti)
                : asetukset.elementti;
            if (!kohde) throw new Error('Lintuloota: elementtiä ei löydy');

            this.api = (asetukset.api ?? '/api').replace(/\/$/, '');
            this.kieli = asetukset.kieli;      // nimien kieli, esim. 'en'. Puuttuu: palvelimen oletuskieli.
            this.tekstit = { ...OLETUSTEKSTIT, ...asetukset.tekstit };
            this.varalinnut = asetukset.varalinnut === false ? [] : (asetukset.varalinnut ?? OLETUSVARALINNUT);
            this.kunValmis = asetukset.kunValmis;
            this.varalintu = null;

            // Rakenne: kuva vasemmalla, teksti ja lisätiedot oikealla
            this.boksi = luo('aside', 'lintuloota');
            this.boksi.setAttribute('aria-label', this.tekstit.nimi);
            this.kuvapaikka = luo('div', 'lintuloota-kuva');
            this.sisalto = luo('div', 'lintuloota-sisalto');
            this.teksti = luo('p', 'lintuloota-teksti');
            this.sisalto.append(this.teksti);
            this.boksi.append(this.kuvapaikka, this.sisalto);
            kohde.replaceChildren(this.boksi);
        }

        // Varalintu vuorotellen: sama koko sivun latauksen ajan, seuraava seuraavalla latauksella
        valitseVaralintu() {
            if (this.varalintu !== null || this.varalinnut.length === 0) return this.varalintu ?? '';
            let i = Math.floor(Math.random() * this.varalinnut.length);
            try {
                const edellinen = Number(localStorage.getItem('lintuloota-varalintu'));
                if (Number.isInteger(edellinen)) i = (edellinen + 1) % this.varalinnut.length;
                localStorage.setItem('lintuloota-varalintu', String(i));
            } catch (e) { /* selaimen tallennus ei käytössä: arvotaan */ }
            this.varalintu = this.varalinnut[i];
            return this.varalintu;
        }

        naytaLataus() {
            this.kuvapaikka.innerHTML = this.valitseVaralintu();
            this.teksti.textContent = this.tekstit.lataus;
            this.boksi.setAttribute('aria-busy', 'true');
        }

        // Näyttää lintutiedon. tieto: /api/lintu-vastaus, johon on voitu yhdistää /api/lintumedia-vastaus.
        nayta(tieto) {
            const laji = tieto.latinaksi || !tieto.tieteellinen
                ? [lihava(tieto.laji, tieto.latinaksi)]
                : [lihava(tieto.laji), ' (', luo('em', null, tieto.tieteellinen), ')'];
            const osat = {
                laji,
                sijainti: [lihava(tieto.sijainti ?? '')],
                paikka: [lihava(`${tieto.paikka} (${tieto.maa})`)]
            };
            this.teksti.textContent = '';
            taytaElementeilla(this.teksti, this.tekstit[`vaihe${tieto.vaihe}`] ?? this.tekstit.vaihe4, osat);

            this.sisalto.querySelector('.lintuloota-kuuntele')?.remove();
            this.sisalto.querySelector('.lintuloota-lahteet')?.remove();
            if (tieto.aani) {
                const kuuntele = luo('p', 'lintuloota-kuuntele', this.tekstit.kuuntele);
                kuuntele.append(this.soittonappi(tieto.aani.url, tieto.laji));
                this.teksti.after(kuuntele);
            }

            if (tieto.kuva) {
                const img = luo('img');
                img.src = tieto.kuva.url;
                img.alt = tieto.laji;
                img.addEventListener('error', () => { this.kuvapaikka.innerHTML = this.valitseVaralintu(); }, { once: true });
                this.kuvapaikka.replaceChildren(img);
            } else {
                this.kuvapaikka.innerHTML = this.valitseVaralintu();
            }

            const lahteet = this.lahteet(tieto.kuva, tieto.aani);
            if (lahteet) this.sisalto.append(lahteet);
            this.boksi.removeAttribute('aria-busy');
        }

        // Soitto/tauko-nappi. Ääni ei ala koskaan itsestään, ja tiedosto ladataan vasta painettaessa.
        soittonappi(url, laji) {
            const nappi = luo('button', 'lintuloota-soita');
            nappi.type = 'button';
            const soitaNimi = tayta(this.tekstit.soita, { laji });
            let aani = null;
            const naytaTila = soi => {
                nappi.innerHTML = soi ? TAUKO_IKONI : SOITA_IKONI;
                nappi.setAttribute('aria-label', soi ? this.tekstit.pysayta : soitaNimi);
            };
            naytaTila(false);
            nappi.addEventListener('click', () => {
                if (!aani) {
                    aani = new Audio();
                    aani.preload = 'none';
                    aani.src = url;
                    aani.addEventListener('play', () => naytaTila(true));
                    aani.addEventListener('pause', () => naytaTila(false));
                    aani.addEventListener('ended', () => { aani.currentTime = 0; naytaTila(false); });
                    aani.addEventListener('error', () => {
                        nappi.disabled = true;
                        nappi.setAttribute('aria-label', this.tekstit.aaniVirhe);
                    });
                }
                if (aani.paused) {
                    aani.play().catch(() => naytaTila(false));
                } else {
                    aani.pause();
                }
            });
            return nappi;
        }

        // Kuvan ja äänen tekijät ja lisenssit (Creative Commons vaatii ne näkyviin)
        lahteet(kuva, aani) {
            if (!kuva && !aani) return null;
            const details = luo('details', 'lintuloota-lahteet');
            details.append(luo('summary', null, this.tekstit.lahteet));
            const rivi = (pohja, arvot, lisenssi, lisenssiUrl) => {
                const p = luo('p', null, tayta(pohja, arvot));
                p.append(linkki(lisenssi ?? this.tekstit.tuntematonLisenssi, lisenssiUrl));
                details.append(p);
            };
            if (kuva) rivi(this.tekstit.kuvanLahde, { tekija: kuva.tekija }, kuva.lisenssi, kuva.lisenssiUrl);
            if (aani) rivi(this.tekstit.aanenLahde, { tekija: aani.aanittaja, numero: aani.numero }, aani.lisenssi, aani.lisenssiUrl);
            return details;
        }

        piilota() {
            this.boksi.hidden = true;
        }

        // Hakee tiedot: ensin lintu ja teksti, sitten kuva ja ääni
        async lataa() {
            this.naytaLataus();
            try {
                const kysely = this.kieli ? `?kieli=${encodeURIComponent(this.kieli)}` : '';
                const tieto = await haeJSON(`${this.api}/lintu${kysely}`);
                if (!tieto.laji) {
                    this.piilota();
                    return;
                }
                this.nayta(tieto);
                this.ilmoitaValmis(tieto);

                const media = await haeJSON(`${this.api}/lintumedia?laji=${encodeURIComponent(tieto.tieteellinen)}`);
                if (media.kuva || media.aani) {
                    this.nayta({ ...tieto, ...media });
                }
            } catch (virhe) {
                console.error('Lintuloota: haku epäonnistui', virhe);
                if (this.boksi.getAttribute('aria-busy')) this.piilota();   // teksti ei ehtinyt näkyviin
            }
        }

        // Kertoo sivulle, että lintu on löytynyt: kunValmis-asetus ja tapahtuma 'lintuloota:valmis'
        ilmoitaValmis(tieto) {
            const tiedot = { ...tieto, omaAlue: tieto.vaihe <= 3 };
            this.kunValmis?.(tiedot);
            this.boksi.dispatchEvent(new CustomEvent('lintuloota:valmis', { detail: tiedot, bubbles: true }));
        }
    }

    // Julkinen rajapinta: window.Lintuloota.kaynnista(asetukset)
    window.Lintuloota = {
        kaynnista(asetukset = {}) {
            const loota = new Lintuloota({ elementti: '#lintuloota', ...asetukset });
            loota.lataa();
            return loota;
        }
    };
})();
