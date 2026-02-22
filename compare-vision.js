const fs = require('fs');
const http = require('http');
const path = require('path');

const brainDir = 'C:\\Users\\adisa\\.gemini\\antigravity\\brain\\85fc8a50-d656-43bc-bbea-ab3726a0119e';
const appleImageFile = path.join(brainDir, 'plus_size_model_analysis_1771787398679.png');
const slimImageFile = path.join(brainDir, 'slim_model_analysis_1771787386215.png');

async function analyzeImage(filePath, label) {
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
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let resData = '';
            res.on('data', (chunk) => { resData += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(resData);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function runTest() {
    try {
        const appleResult = await analyzeImage(appleImageFile, "APPLE");
        const slimResult = await analyzeImage(slimImageFile, "SLIM");

        const results = {
            apple: appleResult,
            slim: slimResult
        };

        fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
        console.log("Test results saved to test-results.json");
    } catch (err) {
        console.error("Test failed:", err);
    }
}

runTest();
