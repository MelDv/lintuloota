// HTTP-funktio /api/lintukuva?laji=Corvus cornix: välittää linnun kuvan Wikimedia Commonsista.
// Kävijän selain hakee kuvan tästä osoitteesta, joten Wikimedia ei näe kävijän IP-osoitetta.

const { app } = require('@azure/functions');
const { varoita } = require('../lintu/apu');
const { kuvadata } = require('../lintu/kuva');

app.http('lintukuva', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const laji = request.query.get('laji');
        try {
            const kuva = await kuvadata(laji);
            if (!kuva) {
                return { status: 404 };
            }
            return {
                body: kuva.data,
                headers: {
                    'Content-Type': kuva.tyyppi,
                    // Selain saa pitää kuvan viikon: sama lintu ei hae samaa kuvaa uudelleen
                    'Cache-Control': 'public, max-age=604800'
                }
            };
        } catch (virhe) {
            varoita(`Kuvan välitys epäonnistui (${laji}):`, virhe);
            return { status: 502 };   // 502 = välitettävä palvelu ei vastannut
        }
    }
});
