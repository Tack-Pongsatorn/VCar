const { onRequest } = require('firebase-functions/v2/https');
const cors = require('cors');
const https = require('https');

const corsHandler = cors({ origin: true });

// Fallback oil price when API fails (บาท/ลิตร ของ "ไฮดีเซล S")
// ค่านี้ใช้เฉพาะกรณีที่เรียก Bangchak API ไม่ได้ ควรอัปเดตเป็นระยะ
const FALLBACK_PRICE = 39.84;

/**
 * Proxy function to fetch oil prices from Bangchak API
 * This solves CORS issues when calling the API from Firebase Hosting
 */
exports.getOilPrice = onRequest({ cors: true }, (req, res) => {
   corsHandler(req, res, () => {
      if (req.method !== 'GET') {
         return res.status(405).json({ error: 'Method not allowed' });
      }

      const externalUrl = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';

      console.log('Proxying request to:', externalUrl);

      https.get(externalUrl, (apiRes) => {
         let data = '';

         apiRes.on('data', (chunk) => {
            data += chunk;
         });

         apiRes.on('end', () => {
            try {
               // ตรวจสอบว่าเป็น JSON หรือไม่
               const jsonData = JSON.parse(data);

               // Set proper headers
               res.set('Content-Type', 'application/json');
               res.set('Cache-Control', 'public, max-age=300'); // Cache 5 minutes

               return res.status(apiRes.statusCode).json(jsonData);
            } catch (error) {
               console.error('Failed to parse response:', error);
               console.log('Returning fallback price:', FALLBACK_PRICE);

               // Return fallback price on parse error
               res.set('Content-Type', 'application/json');
               res.set('X-Fallback', 'true');
               return res.status(200).json({
                  price: FALLBACK_PRICE,
                  isFallback: true,
                  message: 'Using fallback price due to API error'
               });
            }
         });
      }).on('error', (error) => {
         console.error('API request error:', error);
         console.log('Returning fallback price:', FALLBACK_PRICE);

         // Return fallback price on network error
         res.set('Content-Type', 'application/json');
         res.set('X-Fallback', 'true');
         return res.status(200).json({
            price: FALLBACK_PRICE,
            isFallback: true,
            message: 'Using fallback price due to network error'
         });
      });
   });
});
