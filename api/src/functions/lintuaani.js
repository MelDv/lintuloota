// HTTP-funktio /api/lintuaani?laji=Corvus cornix: välittää linnun äänen xeno-cantosta.
// Kävijän selain hakee äänen tästä osoitteesta, joten xeno-canto ei näe kävijän IP-osoitetta.

const { app } = require('@azure/functions');
const { varoita } = require('../lintu/apu');
const { aanidata } = require('../lintu/aani');

app.http('lintuaani', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const laji = request.query.get('laji');
        try {
            const aani = await aanidata(laji);
            if (!aani) {
                return { status: 404 };
            }
            return {
                body: aani.data,
                headers: {
                    'Content-Type': aani.tyyppi,
                    // Selain saa pitää äänen viikon: sama lintu ei hae samaa ääntä uudelleen
                    'Cache-Control': 'public, max-age=604800'
                }
            };
        } catch (virhe) {
            varoita(`Äänen välitys epäonnistui (${laji}):`, virhe);
            return { status: 502 };   // 502 = välitettävä palvelu ei vastannut
        }
    }
});
