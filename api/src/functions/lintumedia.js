// HTTP-funktio /api/lintumedia?laji=Corvus cornix: linnun kuvan ja äänen tiedot (osoitteet, tekijät, lisenssit).
// Erillään /api/lintu-funktiosta, jotta lintutieto ehtii sivulle ennen kuvaa ja ääntä.

const { app } = require('@azure/functions');
const { lintuKuva } = require('../lintu/kuva');
const { lintuAani } = require('../lintu/aani');

app.http('lintumedia', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request) => {
        const laji = request.query.get('laji');
        // Kuva ja ääni haetaan rinnakkain: kumpikaan ei odota toista. Virheet eivät kaada, osa vain jää pois.
        const [kuva, aani] = await Promise.all([lintuKuva(laji), lintuAani(laji)]);
        return {
            jsonBody: { ...(kuva && { kuva }), ...(aani && { aani }) },
            headers: { 'Cache-Control': 'public, max-age=86400' }   // tiedot muuttuvat harvoin
        };
    }
});
