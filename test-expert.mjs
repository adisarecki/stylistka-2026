import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const testToken = process.env.STYLISTKA_TEST_ID_TOKEN;
if (!testToken) {
    console.error("BŁĄD: Wymagana zmienna środowiskowa STYLISTKA_TEST_ID_TOKEN.");
    console.error("Endpoint /api/analyze wymaga autoryzacji Firebase ID Token.");
    console.error("Ustaw zmienną STYLISTKA_TEST_ID_TOKEN przed uruchomieniem skryptu.");
    process.exit(1);
}

const brainDir = 'C:\\Users\\adisa\\.gemini\\antigravity\\brain\\85fc8a50-d656-43bc-bbea-ab3726a0119e';
const appleImageFile = path.join(brainDir, 'plus_size_model_analysis_1771787398679.png');

async function analyzeImage(filePath, label) {
    console.log(`\n--- Analiza dla: ${label} ---`);
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

    const data = JSON.stringify({
        image: base64Image,
        query: "sukienka",
        occasion: "wesele"
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/analyze',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Authorization': `Bearer ${testToken}`
            }
        };

        const req = http.request(options, (res) => {
            let resData = '';
            res.on('data', (chunk) => { resData += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(resData);
                    console.log("FigureType:", json.figureType);
                    console.log("Enhanced apiQuery:", json.apiQuery);
                    resolve(json);
                } catch (e) {
                    console.log("Error Parsing:", resData);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

analyzeImage(appleImageFile, "APPLE / JABŁKO TEST");
