// HTTP-funktio /api/lintu: palauttaa lintutiedon kävijän alueelta.
// Kuva ja ääni haetaan erikseen (/api/lintumedia), jotta teksti ehtii sivulle nopeasti.
// Varsinainen työ tehdään moduuleissa kansiossa src/lintu.

const { app } = require('@azure/functions');
const { KEHITYS, valitseKieli } = require('../lintu/apu');
const { kavijanIp } = require('../lintu/ip');
const { haeSijainti } = require('../lintu/sijainti');
const { haeLintu } = require('../lintu/hakuketju');

app.http('lintu', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request) => {
        // ?kieli=en: nimien kieli, jos se on sallittu (LINTULOOTA_KIELET), muuten oletuskieli
        const kieli = valitseKieli(request.query.get('kieli'));
        const alue = await haeSijainti(kavijanIp(request), kieli);
        // Kehityksessä ?testi-vaihe=2 ohittaa vaiheen 1
        const alkaen = KEHITYS ? Number(request.query.get('testi-vaihe') ?? 1) : 1;
        const lintu = await haeLintu(alue, kieli, alkaen);
        return { jsonBody: { ...lintu, ...(KEHITYS && alue && { testi: alue }) } };
    }
});
