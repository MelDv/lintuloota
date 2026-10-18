// Kävijän IP-osoite: luetaan pyynnöstä ja lyhennetään heti, ettei yksittäistä liittymää voi tunnistaa

const net = require('net');
const { KEHITYS } = require('./apu');

// Palauttaa kävijän lyhennetyn IP-osoitteen (IPv4 tai IPv6) tai null.
// Kehityksessä osoitteen voi antaa itse: ?testi-ip=85.76.12.34
function kavijanIp(request) {
    const otsake = (KEHITYS && request.query.get('testi-ip')) || request.headers.get('x-forwarded-for');
    if (!otsake) {
        return null;
    }
    let osoite = otsake.split(',')[0].trim();          // ensimmäinen osoite

    const hakasulkeissa = osoite.match(/^\[(.+)\]/);    // [IPv6]:portti
    if (hakasulkeissa) {
        osoite = hakasulkeissa[1];
    } else if (osoite.split(':').length === 2) {        // IPv4:portti (tasan yksi kaksoispiste)
        osoite = osoite.split(':')[0];
    }
    if (osoite.startsWith('::ffff:') && osoite.includes('.')) {
        osoite = osoite.slice('::ffff:'.length);        // IPv4 IPv6:n sisällä
    }

    if (net.isIPv4(osoite)) {
        return lyhennaIPv4(osoite);
    }
    if (net.isIPv6(osoite)) {
        return lyhennaIPv6(osoite);
    }
    return null;
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
