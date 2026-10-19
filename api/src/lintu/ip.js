// Kävijän IP-osoite: luetaan pyynnöstä ja lyhennetään heti, ettei yksittäistä liittymää voi tunnistaa

const net = require('net');
const { KEHITYS } = require('./apu');

// Yksityiset ja varatut osoitteet
const SISAISET = new net.BlockList();
SISAISET.addSubnet('10.0.0.0', 8);
SISAISET.addSubnet('172.16.0.0', 12);
SISAISET.addSubnet('192.168.0.0', 16);
SISAISET.addSubnet('127.0.0.0', 8);
SISAISET.addSubnet('169.254.0.0', 16);
SISAISET.addSubnet('100.64.0.0', 10);
SISAISET.addSubnet('fc00::', 7, 'ipv6');
SISAISET.addSubnet('fe80::', 10, 'ipv6');
SISAISET.addAddress('::1', 'ipv6');

// Azure Static Web Appsin oma välityspalvelin x-forwarded-for-otsakkeen lopussa
const AZUREN_VALITYKSET = 1;

// Palauttaa kävijän lyhennetyn IP-osoitteen (IPv4 tai IPv6) tai null.
// Kehityksessä osoitteen voi antaa itse: ?testi-ip=85.76.12.34
function kavijanIp(request) {
    const testiIp = KEHITYS && request.query.get('testi-ip');
    if (testiIp) {
        return lyhenna(siistiOsoite(testiIp));
    }
    const otsake = request.headers.get('x-forwarded-for');
    if (!otsake) {
        return null;
    }
    const osoitteet = otsake.split(',').map(siistiOsoite).slice(0, -AZUREN_VALITYKSET);
    for (const osoite of osoitteet.reverse()) {
        if (osoite && !onSisainen(osoite)) {
            return lyhenna(osoite);
        }
    }
    return null;
}

function onSisainen(osoite) {
    return SISAISET.check(osoite, net.isIPv4(osoite) ? 'ipv4' : 'ipv6');
}

function lyhenna(osoite) {
    if (net.isIPv4(osoite)) {
        return lyhennaIPv4(osoite);
    }
    if (net.isIPv6(osoite)) {
        return lyhennaIPv6(osoite);
    }
    return null;
}

// Poistaa portin ja IPv6:n sisällä olevan IPv4:n etuliitteen. Palauttaa osoitteen tai null.
function siistiOsoite(teksti) {
    let osoite = teksti.trim();
    const hakasulkeissa = osoite.match(/^\[(.+)\]/);    // [IPv6]:portti
    if (hakasulkeissa) {
        osoite = hakasulkeissa[1];
    } else if (osoite.split(':').length === 2) {        // IPv4:portti (tasan yksi kaksoispiste)
        osoite = osoite.split(':')[0];
    }
    if (osoite.startsWith('::ffff:') && osoite.includes('.')) {
        osoite = osoite.slice('::ffff:'.length);        // IPv4 IPv6:n sisällä
    }
    return net.isIP(osoite) ? osoite : null;
}

// 85.76.12.34 → 85.76.12.0
function lyhennaIPv4(ip) {
    return ip.split('.').slice(0, 3).join('.') + '.0';
}

// 2001:708:10::1 → 2001:708:10::  (kolme ensimmäistä ryhmää, loput nollia)
function lyhennaIPv6(ip) {
    // Laajennetaan "::" auki, jotta ryhmät voi laskea: "2001:708::1" → 2001, 708, 0, 0, 0, 0, 0, 1
    const [alku, loppu] = ip.split('::');
    const alkuRyhmat = alku ? alku.split(':') : [];
    const loppuRyhmat = loppu ? loppu.split(':') : [];
    const nollia = ip.includes('::') ? 8 - alkuRyhmat.length - loppuRyhmat.length : 0;
    const ryhmat = [...alkuRyhmat, ...Array(nollia).fill('0'), ...loppuRyhmat];
    return ryhmat.slice(0, 3).join(':') + '::';
}

module.exports = { kavijanIp, lyhennaIPv4, lyhennaIPv6 };
