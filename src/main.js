const Apify = require('apify');
const latinize = require('latinize');

// Apify.utils contains various utilities, e.g. for logging.
// Here we turn off the logging of unimportant messages.
const { log } = Apify.utils;
log.setLevel(log.LEVELS.WARNING);
const sourceUrl = 'https://www.gov.pl/web/koronawirus/wykaz-zarazen-koronawirusem-sars-cov-2';
// Apify.main() function wraps the crawler logic (it is optional).
Apify.main(async () => {
    const requestQueue = await Apify.openRequestQueue();
    const kvStore = await Apify.openKeyValueStore('COVID-19-POLAND');
    const dataset = await Apify.openDataset("COVID-19-POLAND-HISTORY");

    await requestQueue.addRequest({ url: sourceUrl });
    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        handlePageTimeoutSecs: 60 * 2,
        handlePageFunction: async ({ $ }) => {
            const now = new Date();
            const rawData = JSON.parse(latinize($('pre#registerData').text().trim()));
            const countryData = JSON.parse(rawData.parsedData);
            const infectedByRegion = [];
            let infectedCountTotal = 0;
            let deceasedCountTotal = 0;
            for (const region of countryData) {
                const regionName = region.Wojewodztwo;
                const city = region['Powiat/Miasto'];
                const infectedCount = region.Liczba ? parseInt(region.Liczba) : 0;
                const deceasedCount = region['Liczba zgonow'] ? parseInt(region['Liczba zgonow']) : 0;
                infectedCountTotal += infectedCount;
                deceasedCountTotal += deceasedCount;

                infectedByRegion.push({
                    region: regionName,
                    city,
                    infectedCount,
                    deceasedCount,
                });
            }
            const data = {
                infected: infectedCountTotal,
                deceased: deceasedCountTotal,
                infectedByRegion,
                sourceUrl,
                lastUpdatedAtApify: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, now.getMinutes())).toISOString(),
                readMe: 'https://apify.com/vaclavrut/covid-pl',
            };

            await kvStore.setValue('LATEST', data);
            await dataset.pushData(data);
        },

        // This function is called if the page processing failed more than maxRequestRetries+1 times.
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request ${request.url} failed twice.`);
        },
    });

    // Run the crawler and wait for it to finish.
    await crawler.run();

    console.log('Crawler finished.');
});
