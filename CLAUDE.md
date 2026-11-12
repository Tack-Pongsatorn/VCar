# CLAUDE.md

คู่มือสำหรับ Claude Code เมื่อทำงานกับ repository นี้

## ภาพรวม

Single Page Application สำหรับ **คำนวณค่าน้ำมัน/ค่าวิ่งรถที่เบิกเพิ่มได้** ของรถโดยสารที่เดินทางจากจังหวัดต่าง ๆ
มาร่วมงานบุญของวัดพระธรรมกาย (ดูชื่อ title ใน `index.html`)

Stack: **Vue 3 (Composition API + Options API) + Vite 4 + Vuetify 3 + Pinia + Vue Router 4**
Backend: **Firebase Hosting + Cloud Functions (v2) + Firestore (client SDK v8 compat)**
UI/comment เป็นภาษาไทยทั้งหมด

## คำสั่งที่ใช้บ่อย

```bash
npm install              # ติดตั้ง dependencies (root)
npm run dev              # dev server + Vite proxy ไป Bangchak API
npm run build            # build production ลง ./dist
npm run preview          # preview build (ไม่มี proxy ของ API)
npm run type-check       # ⚠️ พังอยู่ — exit 2 เสมอ ไม่ใช่เพราะโค้ดที่คุณเพิ่งแก้ (ดู Conventions)
npm run deploy           # firebase deploy (hosting + functions) — ต้อง npm run build ก่อน!
npm run deploy-hosting   # เฉพาะ hosting
npm run deploy-functions # เฉพาะ functions (ต้อง npm install --prefix functions ก่อน)
```

ไม่มี test runner, linter หรือ formatter ใน repo นี้

**ก่อน deploy อ่านหัวข้อ [Deploy](#deploy) ก่อน** — ต้อง login บัญชีที่ถูกต้อง, build ก่อน,
และ infra ต้องพร้อม 3 ชั้น

สถานะที่รันตรวจจริงเมื่อ **2026-11-12**:

| คำสั่ง / จุดตรวจ | ผล |
|---|---|
| `npm run build` | ✅ ผ่าน (exit 0) |
| `npm run type-check` | ❌ exit 2, error `TS6504` ทุกไฟล์ `.vue` ที่ไม่มี `lang="ts"` — **พังมาก่อนแล้ว ไม่ต้องตกใจ** |
| `https://mbus-rate.web.app/api/oil-price` | ✅ HTTP 200 `application/json` |
| ราคา `ไฮดีเซล S` ที่ API ส่งจริง | 40.79 บาท/ลิตร (`OilPriceDate` 10/11/2569) |
| billing / Cloud Run IAM / `getOilPrice` | ✅ `billingEnabled: true`, `allUsers → roles/run.invoker`, v2 nodejs20 us-central1 256MB |

## โครงสร้างระบบ

```
index.html ──► src/main.ts ──► App.vue (v-app > v-main > router-view)
                  │
                  ├─ pinia
                  ├─ router (src/router/index.ts)
                  └─ vuetify (src/plugins/vuetify.ts) + webfontloader
```

### Routes (`src/router/index.ts`)

| path             | component          | หมายเหตุ |
|------------------|--------------------|----------|
| `/`              | `DieselPriceView`  | หน้าหลักที่ใช้งานจริง (บรรทัด `component: HomeView` ถูก comment ไว้) |
| `/diesel-price`  | `DieselPriceView`  | ชี้ component เดียวกับ `/` |
| `/upload`        | `UploadProvince`   | ปุ่ม seed ข้อมูลลง Firestore — เข้าถึงได้จาก public โดยไม่มี auth |
| `/dhammayatra`   | `DhammayatraView`  | คำนวณค่ารถงานธรรมยาตรา (lazy-load แยก chunk) — ดูหัวข้อ "ค่ารถงานธรรมยาตรา" |

ใช้ `createWebHistory` คู่กับ hosting rewrite `** → /index.html`

### `index.html` (จุดที่คนมักลืมแก้ตามกัน)

- `<html lang="th" class="notranslate" translate="no">` + `<meta name="google" content="notranslate">`
  + `<body class="notranslate">` — กัน Chrome auto-translate มาแปลข้อความไทยจนเพี้ยน **อย่าลบ**
- title + Open Graph + Twitter card เขียนชื่องานไว้ **4 ที่** (`<title>`, `og:title`, `og:site_name`,
  `twitter:title`) และ description อีก 3 ที่ → เปลี่ยนชื่องานทีต้องไล่แก้ให้ครบ ไม่งั้นการ์ด preview
  ใน LINE/Facebook จะโชว์ชื่องานเก่า
- `og:url` ตรึงเป็น `https://mbus-rate.web.app/`
- favicon hotlink ไป `https://www.dhammakaya.net/...` (ไม่ใช่ `.or.th`)

### สามแบบของการคิดราคา

ระบบมีตรรกะการคำนวณ 3 แบบอยู่ในโค้ดพร้อมกัน — แบบที่ 1 เลิกใช้แล้ว แบบที่ 2 อยู่ที่ `/` แบบที่ 3 อยู่ที่ `/dhammayatra`

1. **`HomeView.vue` (ของเดิม, ไม่ได้ผูก route แล้ว)** — เรทเหมาจ่ายต่อจังหวัด
   อ่านจาก Firestore collection `rateCar4` doc = ชื่อจังหวัด → field `van` / `bus`
   ใช้ Options API, import `db` จาก `firebase-config.ts` โดยตรง

2. **`DieselPriceView.vue` (ปัจจุบัน)** — คำนวณจากระยะทาง × อัตราสิ้นเปลือง × ส่วนต่างราคาดีเซล
   ใช้ `<script setup>` + Pinia store ไม่แตะ Firestore

3. **`DhammayatraView.vue` (เพิ่ม 2026-11-12)** — ค่ารถงานธรรมยาตราครบ 6 องค์ประกอบ
   (ราคากลาง + ค่าน้ำมันที่เพิ่มขึ้น + ค่าวิ่งรถออกนอกพื้นที่ + ค่าพักค้าง + ...) ใช้ข้อมูลระยะทางชุดใหม่
   `dhammayatraDistance.js` และใช้สูตรค่าน้ำมันตัวเดียวกับแบบที่ 2 จาก `src/utils/fuel.js`

## Data flow ของราคาน้ำมัน

```
DieselPriceView onMounted
  └─► useDieselStore().fetchDieselPrices()      src/stores/diesel.js
        └─► GET /api/oil-price
              ├─ dev:  Vite proxy (vite.config.ts) ─► https://oil-price.bangchak.co.th/ApiOilPrice2/th
              └─ prod: hosting rewrite (firebase.json) ─► Cloud Function `getOilPrice`
                        └─► functions/index.js ─► Bangchak API (fallback FALLBACK_PRICE ถ้า error)
```

รูปแบบ response ที่ต้องระวัง: API คืน **array** และ `data[0].OilList` เป็น **JSON string** ต้อง `JSON.parse` ซ้อนอีกชั้น
แต่ละรายการมี `OilName`, `PriceToday` (number), `PriceDifYesterday`
วันที่อยู่ที่ `data[0].OilPriceDate` (พ.ศ. รูปแบบ `DD/MM/YYYY`) และข้อความอ่านง่ายที่ `data[0].OilRemark2`
(เช่น `"ราคามีผล ณ วันที่ 11 พ.ย. 69 เวลา 05.00 น."`) — ยังมี `OilDateNow` (วันนี้) และ `OilPriceTime`
ที่ store ไม่ได้เก็บ

ชื่อสินค้าที่ API ส่งมาปัจจุบัน 8 รายการ: `ดีเซล B20` / **`ไฮดีเซล S`** / `ไฮ พรีเมียม ดีเซล พลัส` /
`ไฮ พรีเมียม 98 พลัส` / `แก๊สโซฮอล์ E85 S EVO` / `E20 S EVO` / `91 S EVO` / `95 S EVO`

store map เป็น `{ product_id, product_th, price, diff_price, date_update }`
`currentDieselPrice` เลือกรายการที่ `product_th` มีคำว่า `'ไฮดีเซล S'` (ตรงกับสินค้าเดียวเท่านั้น —
`'ไฮ พรีเมียม ดีเซล พลัส'` มีเว้นวรรคจึงไม่ชน)

**ราคาที่ใช้คำนวณมาจาก API โดยตรง ไม่มีการ hardcode ในฝั่ง client แล้ว**

state ที่ store คืนออกมา:

| ตัวแปร | ความหมาย |
|---|---|
| `prices` | รายการน้ำมันทั้งหมดจาก API (ล้างเป็น `[]` เมื่อ fetch ล้มเหลว) |
| `currentDieselPrice` | รายการ `ไฮดีเซล S` หรือ `null` |
| `loading` / `error` | สถานะ fetch |
| `lastUpdated` | เวลาที่ fetch สำเร็จ (เวลาเครื่อง client) |
| `priceDate` | `OilPriceDate` จาก API — **ไม่มีใครใช้ต่อแล้ว** |
| `priceRemark` | `OilRemark2` จาก API — **ไม่มีใครใช้ต่อแล้ว** |
| `isFallback` | `true` เมื่อได้ราคาสำรองจาก Cloud Function ไม่ใช่ราคาสด |

> ⚠️ ตั้งแต่ commit `48ef9df` หน้าจอ **เลิกแสดงวันที่ราคามีผล** แล้วเปลี่ยนไปประทับ `viewedAt`
> (เวลาที่ผู้ใช้กดปุ่ม "ค้นหา" ซึ่งเป็น ref ในหน้าจอ ไม่ได้อยู่ใน store) → ข้อความใน UI คือ "เรียกดูเมื่อ ..."
> `priceDate` / `priceRemark` จึงยัง set อยู่ใน store แต่ `DieselPriceView` ไม่ได้ `toRef` ออกมา
> (`toRef` มีแค่ `prices`, `loading`, `error`, `lastUpdated`, `isFallback`, `currentDieselPrice`)
> ถ้าจะเอาวันที่ราคามีผลกลับมาโชว์ **ไม่ต้องแก้ store** แค่ bind เพิ่มในหน้าจอ

การจัดการความล้มเหลว:

1. upstream ปกติ → ใช้ `PriceToday` ของ `ไฮดีเซล S`
2. Cloud Function ต่อ Bangchak ไม่ติด (socket error) **หรือ** body ที่ได้ parse เป็น JSON ไม่ได้
   → ส่ง `{ price, isFallback: true }` (**object ไม่ใช่ array**) + header `X-Fallback`
   store ตรวจ `!Array.isArray(data)` แล้วสร้างรายการเดียวจาก `price` + ตั้ง `isFallback = true` → UI ขึ้น alert สีเหลือง
3. HTTP error / JSON เพี้ยน / ไม่มี `ไฮดีเซล S` → ล้าง `prices` ตั้ง `error` → UI ขึ้น alert แดง + ปุ่ม "ลองใหม่"
   (ไม่แสดงผลลัพธ์ 0 เงียบ ๆ เหมือนเดิม)

> ⚠️ **ช่องโหว่ของ fallback**: `functions/index.js` ส่งต่อ `apiRes.statusCode` ของ upstream ตรง ๆ
> ถ้า Bangchak ตอบ 4xx/5xx **พร้อม body ที่เป็น JSON ถูกต้อง** → function จะส่ง status นั้นออกไปเลย
> ไม่เข้า fallback → client เห็นเป็น HTTP error → ขึ้น alert **แดง** (ไม่ใช่เหลือง)
> fallback ทำงานเฉพาะตอน parse ไม่ได้ หรือ network error เท่านั้น

ตารางช่วงราคายังแสดงได้ปกติแม้ดึงราคาไม่ได้ เพราะไม่ได้พึ่ง `currentDieselPrice`

note card ท้ายหน้าอ้างอิงแหล่งราคาเป็น **บางจาก** (`https://oil-price.bangchak.co.th/BcpOilPrice1/th`)
และระบุชัดว่ายอดเปลี่ยนตามราคารายวัน — ต้องแก้ข้อความนี้ด้วยถ้าเปลี่ยนแหล่งราคาหรือกลับไปตรึงราคา

> ⚠️ `FALLBACK_PRICE` ใน `functions/index.js` เป็นราคาสำรอง **ที่ต้องอัปเดตมือเป็นระยะ**
> และการแก้ค่านี้ต้อง `npm run deploy-functions` จึงจะมีผล
> ค่าในโค้ดตอนนี้คือ **39.84** (ตั้งไว้ 2026-09-09) ขณะที่ราคาจริง 2026-11-12 คือ **40.79**
> → ถ้าตกไปใช้ fallback ตอนนี้ ยอดที่คำนวณได้จะ**ต่ำกว่าความจริงประมาณ 12–14%**

## สูตรคำนวณ (`calculateExtraFuelCost` ใน `src/utils/fuel.js`)

สูตรและค่าคงที่เรื่องน้ำมัน (`BASE_PRICE`, `FUEL_RATES` = กม./ลิตร, `VEHICLE_TYPES`) ถูกแยกออกจาก
`DieselPriceView.vue` มาไว้ที่ `src/utils/fuel.js` เมื่อ 2026-11-12 เพื่อให้หน้าธรรมยาตราใช้ตัวเดียวกัน
— ตรวจแล้วว่าให้ผลเท่าฟังก์ชันเดิมทุกกรณี (oilrate 857 แถว × รถ 4 แบบ × 7 ระดับราคา = 23,996 กรณี)
**แก้ค่าที่ไฟล์นี้ = หน้า `/` และ `/dhammayatra` เปลี่ยนพร้อมกัน**

```
distancesAll = distance × 2            // distance ใน oilrate เป็นเที่ยวเดียว จึงคูณ 2 เป็นไป-กลับ
ถ้า price ≤ BASE_PRICE  ─► 0
extraCost = Math.ceil( (distancesAll / kmPerLiter) × (price − BASE_PRICE) )
```

> ระยะทางในไฟล์ข้อมูลทุกไฟล์เป็น**เที่ยวเดียว** สูตรจึงคูณ 2 เป็นไป-กลับ (`litersForRoundTrip`)
> (comment เดิมใน `DieselPriceView` ที่เขียนขัดกันเองว่า "เป็นระยะทางไป-กลับ" ถูกลบไปพร้อมการแยกไฟล์แล้ว)

`distance` ใน `oilrate` เป็น **string** (`"74.00"`) จึงต้องผ่าน `parseFloat` ก่อนเข้าสูตรทุกครั้ง
ค่าทั้งชุดอยู่ในช่วง 20.7–1251 km และแปลงเป็นตัวเลขได้ครบทุกแถว (ตรวจแล้ว)

`BASE_PRICE = 33` export จาก `src/utils/fuel.js` จุดเดียว — `DieselPriceView` import มาใช้ทั้งในสูตร,
ช่วงราคาของตาราง (`priceRangeData` เริ่มที่ `BASE_PRICE` ถึง 50) และข้อความ note card
ส่วนหน้าธรรมยาตราอ้างผ่าน `FUEL_BASE_PRICE` ใน `src/config/dhammayatra.js` (ตั้งให้เท่ากันไว้ แยกได้ถ้านโยบายต่างกัน)

อัตราสิ้นเปลือง (km/ลิตร) = `FUEL_RATES` — ลำดับ key คือลำดับใน dropdown ประเภทรถของทั้งสองหน้า:

| ประเภทรถ | km/L |
|---|---|
| รถตู้ | 10 |
| รถบัสพัดลม | 5.5 |
| รถบัสแอร์1 ชั้น | 4.2 |
| รถบัสแอร์2 ชั้น | 3.2 |

ตารางในหน้าจอไล่ราคา `BASE_PRICE`–50 บาท/ลิตร ด้วยสูตรเดียวกัน

ตัวอย่างยอดที่ราคา 40.79 (ราคาจริง 2026-11-12) — ใช้ตรวจว่าแก้สูตรแล้วยังถูกอยู่ไหม:

| ประเภทรถ | กทม. (74.00 km) | ระยะไกลสุดในชุดข้อมูล (1251 km) |
|---|---|---|
| รถตู้ | 116 | 1,950 |
| รถบัสพัดลม | 210 | 3,544 |
| รถบัสแอร์1 ชั้น | 275 | 4,641 |
| รถบัสแอร์2 ชั้น | 361 | 6,091 |

⚠️ การ์ดสรุป "💰 ค่าน้ำมันที่เบิกเพิ่มได้" มีเงื่อนไข `v-if="... && calculateFuelCostResult > 0"`
→ ถ้าผลเป็น 0 (ราคา ≤ `BASE_PRICE` หรือหาระยะทางไม่เจอ) การ์ดจะ**หายไปเงียบ ๆ** เหลือแต่ตารางกับ note card
ผู้ใช้จะไม่เห็นคำอธิบายว่าทำไมไม่มีตัวเลข

## ค่ารถงานธรรมยาตรา (`/dhammayatra`)

ที่มา: เอกสาร "web แสดงค่ารถ" (การคำนวณค่ารถงานธรรมยาตรา) + ไฟล์ "ระยะทางไปอนุสรณ์สถาน.xlsx"
+ ไฟล์ "ราคากลางธรรมยาตรา 2570.xlsx" + รูปตาราง "แผนธรรมยาตราปีที่ 15 วันที่ 2 - 31 มกราคม พ.ศ. 2570" (ฉบับ 20 ต.ค. 69)

| ไฟล์ | หน้าที่ |
|---|---|
| `src/views/DhammayatraView.vue` | หน้าจอ (`<script setup>`, 3 spaces) — HTML ธรรมดา + scoped CSS **ไม่ใช้ component ฟอร์มของ Vuetify** |
| `src/utils/dhammayatraFare.js` | ตัวคำนวณ — **pure functions** ไม่แตะ Vue import แบบ relative + `.js` จึงรันด้วย node ตรง ๆ ได้ |
| `src/config/dhammayatra.js` | **นโยบายทั้งหมดรวมที่เดียว**: สถานที่, เรทเหมาจ่าย, เกณฑ์ราคากลาง, จังหวัดที่ไม่คิดข้อ 3, **ตารางกิจกรรม `ACTIVITIES`** |
| `src/stores/dhammayatraStandardPrice.js` | ราคากลาง 1,062 **จุดออกรถ** × 4 ประเภทรถ + ระยะทางมาวัด (สร้างจาก xlsx ราคากลาง) — **รายการจุดออกรถหลัก** |
| `src/stores/dhammayatraDistance.js` | ระยะทาง**รายอำเภอ** 863 แถว → วัดพธก. + 4 พื้นที่จัดงาน (สร้างจาก xlsx ระยะทาง) |

`buildOrigins(ราคากลาง, ระยะทาง)` รวมสองไฟล์เป็น 1 รายการต่อจุดออกรถ: ราคากลางจากไฟล์ราคากลาง,
ระยะมาวัด (`toWat`) ใช้ไฟล์ราคากลางก่อน ไม่มีค่อยใช้ไฟล์ระยะทาง, ระยะไปพื้นที่จัดงาน join จากไฟล์ระยะทางด้วย จังหวัด+อำเภอ

**ธรรมยาตราเป็นงานเดียว มีกิจกรรมย่อยตามตารางจริง 34 กิจกรรม ใน 24 วัน** (`ACTIVITIES`, 2–31 ม.ค. 2570)
แต่**จัดรถแค่ 24 กิจกรรม ใน 15 วัน** (`BOOKABLE_ACTIVITIES`) — ผู้ขอฟีเจอร์แจ้ง 2026-11-12 ว่า
"วันที่ไม่มีให้จัดรถคือวันลอยกระทง วันถ่ายภาพ และวันว่าง" → ตัดกิจกรรม `NO_TRANSPORT_ACTIVITY_NAMES`
(`ลอยกระทง`, `ถ่ายภาพหมู่`) ออกจากรายการเลือกและการคำนวณ (ยังเก็บใน `ACTIVITIES` ให้ตรงกับตารางต้นฉบับ)
- ตัดเป็น**รายกิจกรรม** ไม่ใช่รายวัน: 12 ม.ค. มีจุดประทีป + ลอยกระทง วัดสองพี่น้อง → ยังเลือกจุดประทีปได้
  (ถ้านโยบายคือห้ามทั้งวัน ต้องเปลี่ยนเป็นกรองตามวันที่)
- ตัวคำนวณกรองซ้ำอีกชั้น: ส่ง id ของกิจกรรมที่ไม่จัดรถมา จะไม่ถูกนับ
- หน้าจอ**ไม่มี**ข้อความแจ้งเรื่องวันที่ไม่จัดรถ (เคยมีกล่องแจ้ง ผู้ขอฟีเจอร์ให้เอาออก 2026-11-12) — วันเหล่านั้นแค่ไม่อยู่ในรายการ

ผู้ใช้ติ๊กกิจกรรมที่มาร่วม — วันที่มีกิจกรรมที่ติ๊ก = 1 วันที่มาร่วม
ประวัติ: รอบแรกใช้ตารางตัวอย่าง → ผู้ขอบอก "มีกิจกรรมเดียวคือธรรมยาตรา" → เปลี่ยนเป็นเลือก 4 สถานที่ → ผู้ขอส่งตารางจริง
→ กลับมาเลือกตามตาราง (2026-11-12) กติกาที่ยืนยันระหว่างทางยังใช้อยู่ทั้งหมด (ดู "วิธีคิดที่ตีความ")

ถอดตารางจากรูป — จุดที่ตีความ (แก้ใน config ได้):
- "สังฆทาน" (5, 16, 21 ม.ค.) และ "สวดพระพุทธมนต์" (31 ม.ค.) ในรูปไม่ระบุสถานที่ → ใช้สถานที่ของกิจกรรมอื่นในช่องวันเดียวกัน
- "ถ่ายภาพหมู่วิหารหลวงปู่" 28 ธ.ค. 69 อยู่นอกช่วง 2–31 ม.ค. ตามหัวตาราง → **ไม่ได้ใส่**
- "วัดโบสถ์" = `watbotbon` (วัดโบสถ์บน ในไฟล์ระยะทาง), "บางนางแท่น"/"บางปลา"/"โลตัส" = อนุสรณ์สถาน/โลตัสแลนด์
- "เดิน X" → ชื่อกิจกรรม "เดินธรรมยาตรา" ที่สถานที่ X · ป้าย วันพระ (7, 22) / วันเด็ก (9) อยู่ใน `DAY_NOTES`
- สถานที่ที่ **ไม่มีในไฟล์ระยะทาง**: วัดสองพี่น้อง (10, 12, 13 ม.ค.), วัดปากน้ำ (22 ม.ค.), ถนนสีขาว (30 ม.ค.)
  → ไป-กลับ ข้อ 3 ของวันนั้นขึ้น "ไม่มีข้อมูล" · กิจกรรมที่วัดพระธรรมกาย (2, 24, 31 ม.ค.) ข้อ 3 = 0

### องค์ประกอบค่ารถ (เลขข้อตามเอกสาร)

| ข้อ | รายการ | วิธีคิดในโค้ด | ไป-กลับ | พักค้าง |
|---|---|---|---|---|
| 1 | ราคากลาง | ราคาของจุดออกรถ × ประเภทรถที่เลือก (`STANDARD_PRICE_COLUMN`) | × 1 (ไป-กลับมีได้วันเดียว) | × 1 |
| 2 | ค่าน้ำมันที่เพิ่มขึ้น | `toWat` × 2 ÷ กม./ลิตร × (ราคาน้ำมัน − 33) | × 1 | × 1 |
| 3 | ค่าวิ่งรถออกนอกพื้นที่ | (ระยะไปสถานที่**ไกลสุดของวัน** − `toWat`) × 2 ÷ กม./ลิตร × ราคาน้ำมัน**เต็ม**, ติดลบ = 0, ในวัด = 0 · **ไม่คิดใน `NO_OUT_OF_AREA_PROVINCES`** | ทุกวัน | — |
| 4 | ค่าพักค้าง | ตู้ 1,000 / บัส 3,000 | — | × (จำนวนวันในรอบที่พัก − 1) คืน |
| 5 | ค่าวิ่ง วัดพธก. → ที่จัดงาน | ตู้ 500 / บัส 1,000 | — | × วันในรอบที่มีกิจกรรมนอกวัด |
| 6 | ร่วม 2 กิจกรรมในวันเดียว | ตู้ 500 / บัส 1,000 | ถ้าติ๊ก ≥ 2 ในวันนั้น | ต่อวันในรอบที่มี ≥ 2 กิจกรรม |

ข้อ 4–6 และเกณฑ์ราคากลาง รถบัส 3 แบบใช้กลุ่ม "บัส" เดียวกัน (`VEHICLE_CLASS`) ส่วนข้อ 1 ใช้ราคากลางของแต่ละแบบ
และข้อ 2–3 ใช้ กม./ลิตร ตามประเภทรถจริง

### ขั้นตอนบนหน้าจอ

1. จุดออกรถ: จังหวัด → อำเภอ → จุดออกรถ — ช่องจุดออกรถโชว์**เฉพาะอำเภอที่มีหลายจุด** (16 อำเภอนอก กทม.:
   นนทบุรี 6, สมุทรปราการ 6, ปทุมธานี 3, เชียงใหม่ 1 — มากสุด 8 จุด) อำเภอที่มีจุดเดียวเลือกให้อัตโนมัติ
   - **กทม. (`POINT_FIRST_PROVINCES`): ช่องจังหวัดเหมือนเดิม แต่ช่องที่สอง "เขต / จุดออกรถ" รวมจุดออกรถทุกเขต
     129 จุดไว้ในช่องเดียว** ไม่มีขั้นเลือกเขตแล้วเลือกจุด — ผู้ขอฟีเจอร์ระบุแบบนี้ 2026-11-12 หลังลองมา 3 แบบ
     (ช่องเขต+ช่องจุด / ช่องที่สองชื่อ "จุดออกรถ" / รวมจุดในช่องจังหวัดด้วย optgroup) แบบสุดท้ายผู้ขอบอก "ไม่ใช่"
     → **ห้ามย้ายจุด กทม. ไปอยู่ในช่องจังหวัด และห้ามแยกกลับเป็นช่องเขต + ช่องจุด**
     (แบบที่ 2 กับแบบนี้ทำงานเหมือนกัน ต่างแค่ชื่อช่อง — ผู้ขอน่าจะเห็นหน้าเก่าจาก cache 1 ชั่วโมงตอนทดสอบแบบที่ 2)
   - จุด กทม. เรียงตามชื่อจุด (ก–ฮ) จุดที่ชื่อไม่มีเขต/คำว่า "เขต" (8 จุด เช่น "สวนหลวง ร.9") เติม " (เขตX)" ต่อท้าย
     (`pointFirstLabel`)
   - ค่าที่เก็บคือ `pointKeySelect` = `"อำเภอ|จุด"` (ชื่อจุดอย่างเดียวอาจซ้ำข้ามอำเภอได้) ใช้ทั้ง กทม. และจังหวัดอื่น
2. ประเภทรถ
3. แบบการร่วมงาน — ขึ้นกับราคากลาง**ของประเภทรถที่เลือก**เทียบเกณฑ์ `STANDARD_PRICE_LIMIT` (ตู้ 3,500 / บัส 13,000)
   → จุดเดียวกันอาจเลือกเองได้ถ้ามาด้วยรถตู้ แต่ถูกบังคับพักค้างถ้ามาด้วยบัสแอร์ (3,500 พอดียังเลือกเองได้):
   - **ไม่เกิน** (หรือไม่มีราคากลาง) → เลือก ไป-กลับ / พักค้าง
   - **เกิน** → ไม่มีให้เลือก ขึ้นกล่องแจ้งว่าคิดแบบพักค้าง แล้วไปเลือกรอบพักค้างในข้อ 4 (ไม่มีกติกา "3 กิจกรรม" แล้ว)
4. ขึ้นกับแบบการร่วมงาน:
   - **ไป-กลับ → "มาร่วมกิจกรรมไหนบ้าง"**: รายการกิจกรรมจัดกลุ่มตามวัน (หัววันเขียนเต็ม + ป้ายวันพระ/วันเด็ก)
     **เลือกได้ 1 วัน** (`ROUND_TRIP_MAX_DAYS`) ในวันนั้นติ๊กได้หลายกิจกรรม ติ๊กกิจกรรมของวันอื่น = **เปลี่ยนเป็นวันนั้นแทน**
     (`toggleActivity` ล้างวันเดิมให้ ไม่ล็อก เพราะผู้ใช้สูงวัยงงกับปุ่มที่กดไม่ได้) checkbox ใช้ `:checked` + `@change`
   - **พักค้าง (เลือกเอง หรือถูกบังคับ) → "เลือกรอบพักค้าง"**: การ์ด radio 7 รอบจาก `OVERNIGHT_ROUNDS` แต่ละการ์ดบอกกิจกรรม
     รายวันในรอบ — **ไม่มีการติ๊กกิจกรรม** ถือว่าร่วมทุกกิจกรรมจัดรถในวันที่พัก รอบที่มีวันไม่บังคับ (1–2 อยู่ต่อถึง 3,
     21–22 อยู่ต่อถึง 23/24) จะมีคำถาม "อยู่ถึงวันไหน" (radio, ค่าเริ่ม = วันสุดท้ายที่บังคับ, เปลี่ยนรอบแล้วรีเซ็ต)
   - ไป-กลับกับพักค้างเก็บค่าที่เลือกแยกกัน (`activitySelect` / `roundSelect` + `roundEndSelect`) สลับไปมาไม่ปนกัน
5. ผลลัพธ์คำนวณสดทันทีเมื่อเลือกครบ (ไม่มีปุ่มค้นหาเหมือนหน้าเดิม) — ตารางรวมบรรทัดย่อยเป็น 1 แถวต่อหัวข้อ
   (เช่น ข้อ 3 รายวันรวมเป็นแถวเดียว) วิธีคิดเต็มอยู่ใน "ดูวิธีคำนวณ" (`<details>`) ปุ่ม "เริ่มคำนวณใหม่" ล้างทุกช่อง
   — ตารางผลลัพธ์**ไม่โชว์เลขข้อ**ของเอกสาร ใช้ชื่อหัวข้อตาม `GROUP_LABELS` ในหน้าจอ
6. แถบยอดรวมลอยด้านล่าง (`.dy-sticky`) โผล่เมื่อคำนวณได้แล้วแต่ผลลัพธ์ยังไม่อยู่ในจอ (ใช้ IntersectionObserver)
   กด "ดูรายละเอียด" เลื่อนไปที่ผลลัพธ์ — กันผู้ใช้มือถือไม่รู้ว่ามีผลอยู่ด้านล่าง

ข้อมูลขาด → ข้อนั้นเป็น `null` แสดง "ไม่มีข้อมูล" สีแดงพร้อมเหตุผล และใต้ยอดรวมขึ้นว่า "ยอดนี้ยังไม่รวม..." **ไม่นับเป็น 0 เงียบ ๆ**

### แนวทางออกแบบหน้าธรรมยาตรา (ผู้ใช้หลักอายุ 50+ เปิดจากมือถือผ่าน LINE)

ผู้ขอฟีเจอร์ต้องการให้ "ใช้ง่าย ไม่เหมือน AI ทำ" — แก้หน้านี้ให้คงหลักต่อไปนี้:

- ตัวหนังสือพื้นฐาน 18px, รองไม่ต่ำกว่า 16px, line-height 1.6 · ปุ่ม/ตัวเลือก/ช่องเลือก สูงอย่างน้อย 52–60px แตะได้ทั้งการ์ด
- จังหวัด/อำเภอ/จุดออกรถ ใช้ **`<select>` ของระบบ** (มือถือเปิดตัวเลือกเต็มจอแบบที่ผู้ใช้คุ้นเคย) ไม่ใช้ `v-select`
- ประเภทรถ / แบบการร่วมงาน = การ์ด radio, กิจกรรม = แถว checkbox ใหญ่ — input จริงซ่อนด้วย `.dy-sr`
  (ยังโฟกัสด้วยคีย์บอร์ดและโปรแกรมอ่านจอได้) ห้ามเปลี่ยนเป็น `display: none`
- แสดงครบ 4 ขั้นตั้งแต่แรก ขั้นที่ยังทำไม่ได้บอกว่า "เลือก...ในข้อ N ก่อน" ขั้นที่เสร็จแล้วเลขกลายเป็นเครื่องหมายถูก
- ภาษาเรียบง่าย ("รถออกจากที่ไหน", "มาร่วมงานแบบไหน", "มาร่วมกิจกรรมไหนบ้าง") ชื่อกิจกรรมใช้คำตามตารางจริง
  (เดินธรรมยาตรา, ถ่ายภาพหมู่, สังฆทาน, จุดประทีป, ตักบาตร, ลอยกระทง, สวดพระพุทธมนต์)
- **ธีมฟ้า-ขาวไล่เฉด** (ผู้ขอฟีเจอร์ขอ 2026-11-12 — แทนพื้นสีกระดาษเดิม): พื้นหลังไล่จากฟ้าอ่อน `#d6ebff` ลงไปขาว,
  หัวหน้าเป็นแถบน้ำเงินไล่เฉด `#0d47a1 → #1976d2` ตัวหนังสือขาว, การ์ดผลลัพธ์และแถบลอยด้านล่างไล่จากฟ้าอ่อน `#e3f2fd`
  เป็นขาว, ปุ่มหลักไล่ `#1976d2 → #0d47a1`, สีหลัก `#1565c0`, ยอดเงินสีน้ำเงินเข้ม `#0d47a1`
  — การ์ดขั้นตอนยังพื้นขาวล้วน (อ่านง่าย) เส้นขอบฟ้าอ่อน `#c9ddf2` แทนเงา
- **ทุกคู่สีตัวหนังสือ/พื้นต้องผ่าน 4.5:1** (ตรวจแล้ว: ขาวบน `#1976d2` = 4.60 ซึ่งเป็นค่าต่ำสุด, ตัวรองบนขาว = 7.71)
  ถ้าจะทำ gradient ให้อ่อนลง ต้องเช็กฝั่งที่อ่อนที่สุดที่มีตัวหนังสือขาวทับ
- ยังคง: **ไม่ใช้ emoji, เงาฟุ้ง, จัดกลางทั้งหน้า** สีทั้งหมดเป็น CSS variable บน `.dy`
- ใต้ประเภทรถแต่ละแบบโชว์ราคากลางของจุดที่เลือก ให้ผู้ใช้เทียบกับประกาศที่ได้รับได้ทันที

### ⚠️ ข้อมูลที่ยังขาด

- **4 อำเภอยังไม่มีระยะทางไปพื้นที่จัดงาน** → ไป-กลับ ข้อ 3 ขึ้น "—" (ยอดรวมไม่ครบ):
  ชลบุรี/เกาะสีชัง, ตราด/เกาะกูด, พังงา/เกาะยาว, สุราษฎร์ธานี/บ้านตาขุน
  (เดิมขาด 73 อำเภอ แต่อีก 69 อำเภออยู่ใน กทม./นนทบุรี/ปทุมธานี/สมุทรปราการ ซึ่งตัดสินแล้วว่าไม่คิดข้อ 3)
- **ไม่มีระยะทางมาวัดเลย 3 จุด** (เกาะช้าง, เกาะลันตา, เกาะสมุย) → ข้อ 2–3 คิดไม่ได้
- **ระยะทางไปวัดสองพี่น้อง, วัดปากน้ำ, ถนนสีขาว** (ทุกจุดออกรถ) — ต้องเพิ่มคอลัมน์ใน `dhammayatraDistance.js`
  ชื่อคอลัมน์ = key ใน `VENUES` (`songphinong`, `paknam`, `thanonsikhao`) แล้ว `buildOrigins` จะดึงไปใช้เอง

`rate.js` / `province_raw.js` (เรท van/bus รายจังหวัดเดิม บัส 500–2,600) **ไม่ใช่ราคากลาง** — เป็นเรทเหมา
ค่าวิ่งนอกพื้นที่ของธรรมยาตราปีก่อน ตรวจแล้วสองไฟล์ตรงกัน ต่างแค่สะกด "สมุทสาคร" ใน `province_raw.js`

### วิธีคิดที่ตีความจากเอกสาร (ผู้ขอฟีเจอร์ยืนยันแล้ว 2026-11-12)

เอกสารเขียนสูตรข้อ 2–3 ว่า "ระยะทาง × 2 × ราคาน้ำมันต่อลิตร" ซึ่งหน่วยไม่ครบ จึงตีความดังนี้ และผู้ขอฟีเจอร์
ยืนยันว่าใช้ได้ทุกข้อ — **อย่าเปลี่ยนวิธีคิดเหล่านี้โดยไม่ถามก่อน** (ค่าที่ปรับได้อยู่ใน config):

- ข้อ 2 ใช้สูตรเดียวกับหน้าค่าน้ำมันเดิม (÷ กม./ลิตร × ส่วนต่างจาก 33)
- ข้อ 3 ÷ กม./ลิตร × ราคาน้ำมัน**เต็ม** (ระยะที่วิ่งเกินไม่อยู่ในราคากลางเลย) → `OUT_OF_AREA_FUEL_PRICE_MODE`
- ข้อ 3 ถ้าพื้นที่จัดงานใกล้กว่าวัด = 0 (ไม่หักคืน) — เกิดบ่อย เช่นโลตัสแลนด์ใกล้กว่าวัด 353 จุดจาก 849
- ข้อ 3 วันที่มีหลายสถานที่ ใช้สถานที่ที่**ไกลที่สุด**ของวันนั้น (เช่น 6 ม.ค. ตักบาตรโลตัส + เดินบางนางแท่น)
- ราคากลาง = ต่อเที่ยวไป-กลับ · **ไป-กลับเลือกได้วันเดียว** = 1 เที่ยว (ข้อ 1+2+3 + ข้อ 6 ถ้าติ๊ก 2 กิจกรรมในวันนั้น)
- พักค้าง = มาเที่ยวเดียวแล้วพักที่วัดพธก. ทุกวันวิ่ง วัด → ที่จัดงาน (ข้อ 5) **ไม่คิดข้อ 3** · วันที่ทุกกิจกรรมจัดในวัด ไม่คิดข้อ 5
- **พักค้างต้องเลือกจากรอบพักค้างเท่านั้น** (`OVERNIGHT_ROUNDS`, ผู้ขอฟีเจอร์กำหนด 2026-11-12):
  รอบ 1,2,3 (ต้องมา 1, 2 · 3 ไม่บังคับ) / 5,6 / 9,10 / 12,13 / 16,17 / 21,22,23,24 (ต้องมา 21, 22 · 23, 24 ไม่บังคับ) / 30,31
  — แทนกติกาเดิม "ติ๊กกิจกรรมเอง / ห้ามข้ามวัน / บังคับเลือก 3 กิจกรรม" ซึ่งเลิกใช้แล้ว
- ข้อ 4 คิด**ต่อคืน** จำนวนคืน = จำนวนวันในรอบที่พัก − 1 (ผู้ขอยืนยันสูตร "วัน − 1") — วันในรอบติดกันตามปฏิทินจึงเท่ากับคืนจริง
  และนับรวมวันที่ไม่มีกิจกรรม: 1 ม.ค. (วันเดินทางมาถึง) และ 23 ม.ค. (วันว่าง) → รอบ 21 อยู่ถึง 24 = 3 คืน
- เกินเกณฑ์ = บังคับพักค้าง แล้วเลือกรอบเหมือนพักค้างทั่วไป
- ข้อ 6: ไป-กลับคิดเมื่อติ๊ก ≥ 2 กิจกรรมในวันนั้น · พักค้างคิดทุกวันในรอบที่มี ≥ 2 กิจกรรมจัดรถ (ถือว่าร่วมทั้งหมด —
  สมมติฐาน ยังไม่ได้ถามผู้ขอ) เช่น รอบ 5–6 ได้ 2 วัน
- ข้อ 5 (พักค้าง) ไม่นับวันที่ไม่มีกิจกรรม และวันที่ทุกกิจกรรมจัดในวัด (2, 24, 31 ม.ค.)
- ราคากลางใช้ราคาของ**จุดออกรถ**ที่เลือก ตามประเภทรถจริง 4 แบบ (ไม่ได้ใช้ราคาบัสกลางตัวเดียว)
- **ไม่คิดข้อ 3** สำหรับจุดออกรถใน กทม. นนทบุรี ปทุมธานี สมุทรปราการ (`NO_OUT_OF_AREA_PROVINCES`) — ตารางแสดง
  บรรทัดข้อ 3 เดียวเป็น 0 พร้อมเหตุผล ไม่ใช่ "—" · นครปฐม / สมุทรสาคร (ปริมณฑลตามนิยามราชการ) มีข้อมูลระยะทาง
  จึง**ยังคิดข้อ 3** ถ้าจะให้ไม่คิดด้วย เพิ่มชื่อจังหวัดใน list นี้ (เป็น 4 จังหวัดชุดเดียวกับ `provinceWithoutDistrict` หน้า `/`)

### ข้อมูลราคากลาง (`dhammayatraStandardPrice.js`)

- 1,075 แถวใน xlsx → เก็บ 1,062 จุด **ตัดแถวที่ราคาเป็น 0 ทุกประเภทรถ 13 แถว** (แถว "บ้านทะเบียน(ทดสอบN)",
  "วัดพระธรรมกาย", "ชุมชนรอบวัด", "คลองสาม", "ทุ่งเศรษฐี" ฯลฯ — รายชื่อเต็มอยู่หัวไฟล์) ไม่มีแถวที่ 0 แค่บางประเภทรถ
- ราคาเรียง ตู้ ≤ พัดลม ≤ แอร์1 ≤ แอร์2 ทุกแถว; ช่วงราคา ตู้ 800–15,000, แอร์2 ถึง 52,000
- จุดในอำเภอเดียวกันราคาต่างกันได้ (8 อำเภอ เช่น กทม./ดอนเมือง ตู้ 2,000 กับ 1,500) จึงต้องเลือกถึงระดับจุด
- คอลัมน์ "ระยะทาง" = ระยะมาวัดพธก. ตรงกับไฟล์ระยะทาง 880 จุด **ต่าง 9 จุด** (ไฟล์ราคากลางสั้นกว่าเสมอ เช่น
  เชียงราย/เวียงแก่น 788 vs 933, นครศรีธรรมราช/นบพิตำ 774 vs 837) → ใช้ค่าไฟล์ราคากลาง เพราะเป็นฐานของราคากลาง
  และ 933 ดูผิดปกติ (พื้นที่จัดงานใกล้กว่าวัด 90 กม. ทั้งที่มาจากภาคเหนือ) — ข้อ 3 จึงคิดจาก (ระยะไปพื้นที่จัดงาน − 788)
- ราคากลาง × 4 ประเภทรถ: เลือกเองได้ 1,695 กรณี / บังคับพักค้าง 2,553 กรณี

### ข้อมูลระยะทางชุดใหม่ vs `oilrate.js`

คอลัมน์ `toWat` ตรงกับ `oilrate.js` 852 แถว แต่ต่างกัน 5 แถว (กทม./นนทบุรี/ปทุมธานี/สมุทรปราการ
ระบุอำเภอแล้วระยะสั้นลง เช่น ปทุมธานี 39.6 → 4.8, และเชียงราย/เวียงแก่น 808 → 933) และมีอำเภอเกาะใหม่ 6 แห่ง
→ หน้า `/` ยังใช้ `oilrate.js` ชุดเดิม ถ้าจะให้สองหน้าใช้ระยะเดียวกันต้องตัดสินใจว่าชุดไหนถูก

ช่องว่าง/0 ใน Excel แปลงเป็น `null` และค่าที่มีหมายเหตุ เช่น `"526 (เท่ากัน)"` ใช้ตัวเลขข้างหน้า
(รายการจุดที่ข้อมูลขาดอยู่ใน comment หัวไฟล์) — ถ้าได้ xlsx ใหม่ ต้องแปลงซ้ำด้วยกติกาเดียวกัน
(repo ไม่มี parser xlsx; ครั้งแรกแตก zip อ่าน XML ด้วย python เพราะเครื่องไม่มี `openpyxl`)

### การทดสอบหน้าธรรมยาตรา

- **ทุกช่องกดได้จริงจาก automation** (ไม่มี `v-select` แล้ว) — `<select>` ตั้งค่าด้วย `form_input` หรือ
  `el.value = ...; el.dispatchEvent(new Event('change', { bubbles: true }))`, การ์ด/แถว คลิกที่ `<label>` ได้เลย
- ต้องเลือก จังหวัด → รอ ~250ms → อำเภอ → รอ → จุดออกรถ ตามลำดับ (watcher ล้างค่าลูกเมื่อค่าแม่เปลี่ยน)
  — กทม. มี 2 `<select>` (จังหวัด, เขต / จุดออกรถ) ค่า option ช่องที่สองคือ `"อำเภอ|จุด"` ไม่ใช่ข้อความที่เห็น
- ถ้าผู้ใช้เปิดแท็บเดียวกันอยู่ ให้ทดสอบในแท็บแยก (`tabs_create`) จะได้ไม่แย่งกันคลิก — แท็บพื้นหลัง smooth scroll
  ช้ากว่าปกติ (~1.5 วินาที) อย่าเพิ่งสรุปว่าปุ่ม "ดูรายละเอียด" เสีย
- ตัวอย่างค่าที่ตรวจแล้ว (ราคาน้ำมัน 40.79, ชัยนาท/เนินขาม รถตู้ ราคากลาง 3,500 เว้นแต่ระบุ):
  - ไป-กลับ 6 ม.ค. ตักบาตร + เดินธรรมยาตรา = **4,547** (3,500 + 253 + 294 + 500) แล้วแตะ 9 ม.ค. → เหลือ 9 ม.ค. = 4,047
  - พักค้าง รอบ 5–6 = **6,753** (3,500 + 253 + 1,000 + 1,000 + 1,000) · รอบ 1–2 = 4,753 · รอบ 1 อยู่ถึง 3 = 6,253
  - พักค้าง รอบ 21–22 = 6,753 · อยู่ถึง 24 = **8,753** (3 คืน) · รอบ 30–31 = 5,753
  - เชียงราย/เวียงแก่น บัสแอร์2 (ราคากลาง 38,000 → บังคับ) รอบ 5–6 = **48,837**
  - กทม. → "เขต / จุดออกรถ (129 จุด)" → "สวนหลวง ร.9 (เขตประเวศ)" รถตู้ ไป-กลับ 6 ม.ค. ตักบาตร = 2,098

## ข้อมูล (data files)

ไฟล์ใน `src/stores/` **ส่วนใหญ่ไม่ใช่ Pinia store** แต่เป็น array ที่ `export default` เฉย ๆ

| ไฟล์ | ชนิด | เนื้อหา | ใช้ที่ไหน |
|---|---|---|---|
| `src/stores/diesel.js` | Pinia store จริง | ราคาน้ำมัน + fetch logic | `DieselPriceView` |
| `src/stores/oilrate.js` | array (~857 รายการ) | `{ province, amphur, distance }` ระยะทางระดับอำเภอ | `DieselPriceView` |
| `src/stores/province.js` | array (77 รายการ) | `{ id, name_th, name_en, ... }` จังหวัดทั้งประเทศ | `DieselPriceView`, `HomeView` |
| `src/stores/rate.js` | array (74 รายการ) | เรทเหมาจ่าย van/bus | **ไม่ถูก import ที่ไหนเลย** |
| `src/assets/province_raw.js` | array (73 รายการ) | เรทเหมาจ่าย van/bus (ชุด seed) | `UploadProvince` |
| `src/assets/oilrate.js` | array | **ไฟล์ซ้ำ identical กับ `src/stores/oilrate.js`** | ไม่ถูก import |
| `src/stores/counter.ts` | Pinia store | ตัวอย่างจาก template | ไม่ถูกใช้ |
| `src/stores/dhammayatraStandardPrice.js` | array (1,062 รายการ) | `{ province, amphur, point, van, fan, air1, air2, toWat }` ราคา/ระยะเป็น **number** หรือ `null` | `DhammayatraView` |
| `src/stores/dhammayatraDistance.js` | array (863 รายการ) | `{ region, province, amphur, toWat, lotusland, bangnangtaen, watbotbon, bangpla }` ระยะเป็น **number** หรือ `null` | `DhammayatraView` |

### ตรรกะจังหวัด/อำเภอ

- `provinceWithoutDistrict = ['กทม.', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ']` → ซ่อน select อำเภอ
  และ match ระยะทางด้วย `province` เพียงตัวเดียว จังหวัดอื่นต้อง match ทั้ง `province` + `amphur`
- รายการอำเภอ derive จาก `oilrate` ตามจังหวัดที่เลือก (unique + sort ด้วย `localeCompare(..., 'th')`)
- dropdown จังหวัดมาจาก `province.js` แต่ระยะทางมาจาก `oilrate.js` — **ตรวจข้อมูลจริงแล้ว 2026-11-12
  ว่าสองไฟล์ตรงกันครบ**: ชื่อจังหวัดทั้ง 77 ใน `province.js` มีใน `oilrate.js` ครบทุกตัว (ไม่มีขาดทั้งสองทาง),
  ไม่มีคู่ `province`+`amphur` ซ้ำ, และทุกจังหวัดที่ไม่อยู่ใน `provinceWithoutDistrict` มีอำเภออย่างน้อย 1 รายการ
  → เส้นทาง `foundDistance = null` **ยังไม่เกิดกับข้อมูลชุดปัจจุบัน**
- ⚠️ แต่ guard นั้นยัง "เงียบ" อยู่: ถ้าหาไม่เจอจะ `console.warn` อย่างเดียว แล้วผลลัพธ์กลายเป็น 0
  **แก้/เพิ่มจังหวัดใน `province.js` เมื่อไร ต้องแก้ `oilrate.js` ให้ตรงกันเสมอ** ไม่งั้นจะได้เคสนี้ทันที
- จังหวัดที่ `amphur` ว่างใน `oilrate` มี 4 ตัวพอดีและเป็นชุดเดียวกับ `provinceWithoutDistrict`
  (กทม. 74.00, นนทบุรี 58.70, ปทุมธานี 39.60, สมุทรปราการ 81.20 km) — แก้ list ไหนต้องแก้อีก list ตาม
  ไม่งั้นจังหวัดนั้นจะไม่มีอำเภอให้เลือกเลย หรือเลือกอำเภอแล้วหาไม่เจอ
- ชื่อกรุงเทพใน `oilrate`/`province.js` คือ `"กทม."` (ไม่มี `"กรุงเทพมหานคร"` ในทั้งสองไฟล์)
  แต่ `HomeView.provinceWithout` เขียนว่า `"กรุงเทพมหานคร"` — ชื่อไม่ตรงกัน (ไม่กระทบ เพราะ `HomeView` ไม่ได้ใช้งาน)

## Firebase

> 📌 **อ่านหัวข้อ "Deploy" ด้านล่างก่อน deploy ทุกครั้ง** — มี 3 ชั้นของ infra ที่ต้องพร้อม
> ไม่ใช่แค่ `firebase deploy`

- **Deploy target**: `.firebaserc` → project `mbus-rate`
- **Firestore client**: `firebase-config.ts` ชี้ project `flueratecar` (ต่างจาก deploy target)
  API key อยู่ใน repo ตรง ๆ; ใช้ **Firebase SDK v8 namespaced API** (`firebase/app` + `firebase/firestore`,
  เรียกแบบ `db.collection('rateCar4').doc(x).get()`) — **ห้ามผสมกับ v9 modular syntax**
- **Hosting**: serve `./dist`, rewrite `/api/oil-price` → function `getOilPrice`, ที่เหลือ `** → /index.html`
- **Functions**: `functions/` เป็น package แยก (`npm install` ของตัวเอง), Node 20,
  `firebase-functions` 5.1.1 + `firebase-admin` 12.7.0 (ติดตั้งไว้แต่**ไม่ได้ import ใน `index.js`**) + `cors` 2.8.6
  ใช้ `onRequest` จาก `firebase-functions/v2/https` และห่อ `corsHandler` ซ้ำอีกชั้นหนึ่ง (ซ้ำซ้อนแต่ไม่เสียหาย)
  รับเฉพาะ `GET` (เมธอดอื่นได้ 405) ตอบ 200 พร้อม `{ price, isFallback: true }` และ header `X-Fallback`
  เมื่อ upstream ล้มเหลว, cache `public, max-age=300`
- `firestore.rules` / `firestore.indexes.json` ถูกลบออกจาก repo แล้ว (commit `5f73d63`) — กฎ Firestore
  ไม่ได้ถูกจัดการจากที่นี่
- `.firebase/hosting.ZGlzdA.cache` เป็น deploy cache ที่ถูก commit ติดมา (ไม่ต้องแก้มือ)
- Cloud Function `getOilPrice` เป็น **2nd gen** → เบื้องหลังคือ Cloud Run service ชื่อ `getoilprice`
  (ตัวพิมพ์เล็กทั้งหมด) region `us-central1` URL ตรง: `https://getoilprice-etlqyrnxmq-uc.a.run.app`

## Deploy

### บัญชีที่ใช้ deploy ได้ ⚠️

โปรเจกต์ `mbus-rate` และ `flueratecar` อยู่ใต้ **บัญชี Gmail ส่วนตัวของเจ้าของ repo
ไม่ใช่บัญชีบริษัท `@mobileconnect.co.th`** (ดูบัญชีที่ login อยู่ด้วย `firebase login:list`)

บัญชีบริษัทจะ deploy ไม่ได้และ error กำกวมมาก:

```
Error: Failed to get Firebase project mbus-rate. Please make sure the project exists
       and your account has permission to access it.
```

เช็คก่อนเสมอ — ถ้า grep ไม่เจอ แปลว่า login ผิดบัญชี:

```bash
npx firebase login:list
npx firebase projects:list | grep -i mbus
```

### ขั้นตอน deploy

```bash
npm install --prefix functions   # functions/ เป็น package แยก ถ้าไม่ install → CLI discover function ไม่เจอ
npm run build                    # ต้อง build ก่อน! firebase.json ไม่มี predeploy hook
npx firebase deploy --non-interactive
```

**`firebase.json` ไม่มี predeploy hook** — ถ้าไม่ `npm run build` ก่อน จะ deploy `dist/` เก่าหรือไม่มีเลย

### 3 ชั้นของ infra ที่ต้องพร้อม (ทั้งหมดแก้แล้ว 2026-09-09)

ประวัติสำคัญ: **API path ไม่เคยทำงานบน production เลยตั้งแต่ต้น** เพราะ 3 เรื่องนี้ซ้อนกัน
นี่คือเหตุผลจริงที่โค้ดเดิม hardcode ราคา ไม่ใช่โค้ดค้าง

| ชั้น | อาการ | ทางแก้ |
|---|---|---|
| 1. hosting rewrite ไม่ถูก deploy | `/api/oil-price` ตอบ `index.html` (HTTP 200, `text/html`) ตกไป catch-all `**` | `firebase deploy --only hosting` |
| 2. Cloud Run IAM ว่างเปล่า (ไม่มี binding เลย) | **403 Forbidden** | คำสั่งด้านล่าง |
| 3. billing ปิด (Spark plan) | **503** + log `The request failed because billing is disabled for this project` | เปิด Blaze plan (ต้องผูกบัตร ทำผ่าน console เท่านั้น) |

```bash
# ชั้น 2 — เปิดให้เรียกแบบ public (function ตัวนี้เป็น public CORS proxy อยู่แล้วโดยดีไซน์)
gcloud run services add-iam-policy-binding getoilprice \
  --project=mbus-rate --region=us-central1 \
  --member=allUsers --role=roles/run.invoker
```

**Blaze plan จำเป็น** — Cloud Functions ทำงานไม่ได้เลยบน Spark plan และ `firebase deploy` จะ error
`Extensions require the Blaze plan` ตั้งแต่ขั้นเตรียม — **เปิด Blaze แล้วเมื่อ 2026-09-09**

**เรียก Bangchak API ตรงจากเบราว์เซอร์ไม่ได้** — ทดสอบแล้วว่า API ไม่ส่ง `Access-Control-Allow-Origin`
มาเลย (`TypeError: Failed to fetch`) → Cloud Function proxy เป็นทางเดียว ตัดออกไม่ได้

### คำสั่งตรวจสอบหลัง deploy

```bash
gcloud billing projects describe mbus-rate                    # ต้อง billingEnabled: true
gcloud run services get-iam-policy getoilprice --project=mbus-rate --region=us-central1
npx firebase functions:list
curl -s -w '\n%{http_code} %{content_type}\n' https://mbus-rate.web.app/api/oil-price | tail -2
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="getoilprice"' \
  --project=mbus-rate --limit=10 --freshness=1h
```

ต้องได้ `HTTP 200` + `application/json` — ถ้าได้ `text/html` แปลว่า rewrite ไม่ทำงาน (ชั้น 1)

### สถานะ production ที่ยืนยันแล้ว (ตรวจซ้ำ 2026-11-12)

URL: **https://mbus-rate.web.app** (และ `mbus-rate.firebaseapp.com`)

| รายการ | 2026-09-09 | 2026-11-12 |
|---|---|---|
| `/api/oil-price` | HTTP 200, `application/json` | ✅ เหมือนเดิม |
| ราคา `ไฮดีเซล S` | 39.84 | **40.79** (`OilPriceDate` 10/11/2569) |
| `isFallback` / `error` | `false` / `null` | ✅ เหมือนเดิม |
| สินค้าที่ parse ได้ | 8 รายการ | ✅ 8 รายการ |
| กทม./รถตู้ | 102 บาท | **116 บาท** (ตรงกับสูตร) |
| billing | `billingEnabled: true` | ✅ เหมือนเดิม |
| Cloud Run IAM | `allUsers → roles/run.invoker` | ✅ เหมือนเดิม |
| runtime ที่ deploy อยู่ | nodejs20 | ⚠️ ยัง nodejs20 (ดู "หนี้ที่ต้องจัดการ") |

ยอดที่เบิกได้ขึ้นลงตามราคารายวัน — ตัวเลขในตารางนี้คือ snapshot ไม่ใช่ค่าคงที่

**Deploy hosting 2026-11-12** (`firebase deploy --only hosting` 4 รอบ — ไม่ได้ deploy functions เพราะไม่ได้แก้
และเลี่ยงปัญหา Node 20):
- รอบ 1: หน้า `/dhammayatra` แบบเลือก 4 สถานที่ + แยกสูตรน้ำมันไป `src/utils/fuel.js`
- รอบ 2: ตารางกิจกรรมจริง 34 กิจกรรม (`index-d006994b.js` + `DhammayatraView-a80b7932.js`)
- รอบ 3: ตัดกิจกรรมที่ไม่จัดรถ + กทม. เลือกจุดออกรถช่องที่สอง (`index-98289b63.js` + `DhammayatraView-3a9dde49.js`)
- **รอบ 4 (ล่าสุด): ช่อง "เขต / จุดออกรถ" ของ กทม. + ไป-กลับวันเดียว + ธีมฟ้า-ขาว + เอาข้อความ 2 จุดออก
  + พักค้างเลือกตามรอบ** — บันเดิลหลัก `index-23f2b921.js` + chunk `DhammayatraView-89c948fa.js`
  ตรวจบน production แล้ว (เปิดด้วย `?nocache=` เลี่ยง cache): ราคา 40.79 สด, 7 รอบพักค้าง,
  ชัยนาท/เนินขาม รถตู้ รอบ 5–6 = 6,753 / รอบ 21 อยู่ถึง 24 = 8,753 / ไป-กลับ 6 ม.ค. 2 กิจกรรม = 4,547
  (แตะ 9 ม.ค. → 4,047), เวียงแก่น บัสแอร์2 บังคับ รอบ 5–6 = 48,837, กทม. ช่อง "เขต / จุดออกรถ (129 จุด)"

✅ ซอร์สที่ deploy รอบ 4 **commit แล้ว** บน branch `claude/system-understanding-claude-md-1076c5`
(`7e6c016` refactor สูตรน้ำมัน, `2fcd8a2` หน้าธรรมยาตรา, `bc65cd3` docs, `68de1f5` deploy cache) —
⚠️ **ยังไม่ได้ push และยังไม่ได้ merge เข้า `main`** (branch นี้นำ `main` อยู่ 10+ commit รวมงาน 2026-09-09 ด้วย)
ถ้าเครื่องนี้หายก่อน push จะซ้ำรอยหัวข้อถัดไป · push จากเครื่องนี้ต้องใช้ git ตัวที่ต่อ HTTPS ได้ (git ใน PATH ต่อ HTTPS ไม่ได้)

⚠️ **Firebase Hosting ส่ง `cache-control: max-age=3600` ทุกไฟล์รวม `index.html`** (`firebase.json` ไม่ได้ตั้ง `headers`)
→ คนที่เปิดหน้าไว้ภายใน 1 ชั่วโมงก่อน deploy จะยังเห็นเวอร์ชันเก่าจนกว่า cache หมดอายุหรือรีเฟรชแบบล้าง cache
(ตอนตรวจหลัง deploy รอบ 2 Chrome ยังได้หน้ารอบ 1 — ต้องเปิดด้วย `?nocache=...` ถึงได้ของใหม่)
ทางแก้ถาวร: เพิ่ม `hosting.headers` ให้ `/index.html` และ route SPA เป็น `no-cache` ส่วน `/assets/**` (ชื่อไฟล์มี hash)
เป็น `max-age=31536000, immutable`

### ⚠️ ซอร์สของ production เดิมไม่อยู่ใน git

build ที่อยู่บน production ก่อนหน้านี้ (`2026-04-21T01:47:36`) สร้างจากซอร์สที่**ไม่มีใน repo นี้**
สังเกตจาก: มี attribute `data-build-version` บน `<html>` และบันเดิลไม่มี `api/oil-price` / `oilrate` /
`ไฮดีเซล` เลย — เป็นเวอร์ชันที่ตัดการเรียก API ออกหมดและตรึงข้อความ
`ราคาน้ำมันดีเซล ณ วันที่ 20 เมษายน 2569`

> 🔸 เดิมเคยใช้ "favicon ชี้ `dhammakaya.net` ขณะที่ repo ใช้ `dhammakaya.or.th`" เป็นจุดสังเกต —
> **ใช้ไม่ได้แล้ว** เพราะ `index.html` ใน repo ตอนนี้ก็ชี้ `dhammakaya.net` เหมือนกัน
> เหลือจุดสังเกตที่เชื่อถือได้คือ `data-build-version` และการไม่มี `api/oil-price` ในบันเดิล

`origin/main` = `main` = `7eaac8f` → **GitHub ก็ไม่มีซอร์สนั้น** อยู่แค่บนเครื่องคนที่ build
build นั้นถูก deploy ทับไปแล้ว (เจ้าของ repo อนุมัติ) — Firebase ยังเก็บ release history
กู้ไฟล์ที่ deploy ได้จาก console แต่**ซอร์สกู้ไม่ได้**

ถ้ามีใครถือซอร์สนั้นอยู่ ควรเอาเข้า git เพื่อไม่ให้ประวัติขาด

### หนี้ที่ต้องจัดการ

- 🔴 **Node 20 — กำหนดปิด 2026-10-30 ผ่านมาแล้ว** (deprecate ตั้งแต่ 2026-04-30)
  ตรวจเมื่อ 2026-11-12: function ที่ deploy อยู่ยังเป็น `nodejs20` และยังตอบ HTTP 200 ได้ปกติ
  → **ของที่รันอยู่ยังไม่ดับ แต่จุดเสี่ยงคือ `deploy-functions` ครั้งถัดไป** ซึ่งอาจถูกปฏิเสธ
  **ห้าม deploy functions โดยไม่เผื่อเวลาแก้** ถ้าโดนปฏิเสธต้อง:
  อัป `runtime` ใน `firebase.json` + `engines` ใน `functions/package.json` เป็น Node 22
  และ `npm install --save firebase-functions@latest --prefix functions` (5.1.1 → v6+ มี breaking changes)
  ควรทำล่วงหน้าตอนไม่รีบ ไม่ใช่ตอนต้องแก้ราคาด่วน
- 🔴 `FALLBACK_PRICE` = **39.84** แต่ราคาจริงวันนี้ **40.79** — ห่างกันเกือบ 1 บาท (ดูหัวข้อ Data flow)
  และต้องแก้โดย `npm run deploy-functions` เท่านั้น (ซึ่งติดข้อก่อนหน้า)
- 🟠 `npm run type-check` พัง (exit 2) — ดู Conventions
- Blaze plan คิดเงินตามการใช้งาน — function cache 5 นาที (`max-age=300`) โหลดน่าจะอยู่ใน free tier
  แต่ควรตั้ง budget alert
- `firebase` client SDK ยังเป็น **v8.10.1** (namespaced, EOL) และ Vuetify ติดตั้งจริงคือ 3.0.5
  จาก `^3.0.0-beta.0` ใน `package.json` — ถ้า `npm install` ใหม่อาจได้เวอร์ชันต่างไป ควร pin

## Conventions

- **Indentation ไม่สม่ำเสมอ** → ยึดตามไฟล์ที่กำลังแก้:
  **3 spaces** = `main.ts`, `vite.config.ts`, `router/index.ts`, `stores/diesel.js`, `DieselPriceView.vue`,
  `functions/index.js`, `DhammayatraView.vue`, `utils/*`, `config/*` · **2 spaces** = `App.vue`, `HomeView.vue`, `province.js`, `firebase-config.ts`
  · **4 spaces** = `UploadProvince.vue`
- ไฟล์ใหม่เขียนเป็น **JavaScript** ไม่ใช่ TypeScript (`.js` store, `<script setup>` ไม่มี `lang="ts"`)
  แม้โปรเจกต์จะ config TS ไว้
- ⚠️ **`npm run type-check` พังอยู่ก่อนแล้ว — ไม่ใช่ความผิดของโค้ดที่คุณเพิ่งแก้**
  `vue-tsc --noEmit` exit **2** พร้อม error `TS6504` 4 ตัว (`DhammayatraView.vue.js`, `DieselPriceView.vue.js`,
  `HomeView.vue.js`, `UploadProvince.vue.js`) เพราะ `<script>` ของไฟล์เหล่านี้ไม่มี `lang="ts"` → vue-tsc มองเป็นไฟล์ JS
  แต่ `tsconfig.json` ไม่ได้เปิด `allowJs` ส่วน `include` ก็กวาด `src/**/*` ทั้งหมด
  ทางแก้ถ้าจะทำ: เปิด `allowJs` + `checkJs: false` หรือ exclude ไฟล์เหล่านี้ — **`npm run build` ไม่ได้
  เรียก type-check จึงผ่านปกติ** (`build` = `vite build` เฉย ๆ)
- alias `@` → `./src` (ตั้งไว้ทั้งใน `vite.config.ts` และ `tsconfig.json`)
  แต่โค้ดบางส่วนยัง import แบบ relative (`../stores/province`, `../../firebase-config`) — ใช้ทั้งสองแบบผสมกัน
- comment / log / ข้อความ UI เป็นภาษาไทย, `console.log` ใช้ emoji นำหน้า (`📡 ✅ ⚠️ ❌ 🎯`) และยังเปิดอยู่ใน production
- Vuetify components auto-import ผ่าน `vite-plugin-vuetify` (ไม่ต้อง import เอง)
- font: Noto Sans Thai โหลดจาก Google Fonts ใน `App.vue` และบังคับ `* { font-family: ... !important }`
- รูปภาพ: พื้นหลังของหน้าที่ใช้งานจริงเป็นไฟล์ **local** `public/bg-vstar.jpg` (376 kB, `v-parallax src="/bg-vstar.jpg"`)
  ส่วนที่ยัง hotlink ภายนอกคือ favicon ใน `index.html` (`dhammakaya.net`) และรูปใน `HomeView.vue`
  (`dmc.tv` 2 รูป) ซึ่งเป็นหน้าที่ไม่ได้ใช้แล้ว — **ไม่มี twimg / dhammakaya.or.th เหลือในโค้ดแล้ว**

## การทดสอบ (ไม่มี test runner)

ทดสอบด้วยการรัน dev server แล้วขับ component ผ่าน browser — แต่ **Vuetify `v-select`
ไม่รับ click จาก automation** (overlay ค้าง/ไม่ propagate) วิธีที่ใช้ได้จริง:

- **dev build** — เข้าถึง `setupState` ของ `<script setup>` ได้ ตั้งค่า ref แล้วเรียก method ตรง ๆ:
  ไล่ component tree จาก `document.querySelector('#app').__vue_app__._instance`
  หา instance ที่ `setupState` มี key `provinceSelect`
  **ต้องหน่วง ~500ms หลังตั้งค่า ก่อนเรียก `handleSearch()`** ไม่งั้น Vuetify ยัง validate ไม่ผ่าน
- **production build** — `setupState` ไม่ถูก expose ต้องอ่าน Pinia store แทน:
  วน `Reflect.ownKeys(app.__vue_app__._context.provides)` หา object ที่มีทั้ง `.state` และ `._s`
  แล้ว `pinia._s.get('diesel')`
- ทดสอบ error path ด้วยการ patch `window.fetch` — **ต้องเก็บ `window.fetch.bind(window)` ไว้ก่อน
  และคืนค่าให้ครบทุกครั้ง** ถ้า script พังกลางทางจะเหลือ fetch ที่ถูก patch ค้าง
  ทำให้การทดสอบรอบถัดไปอ่านผลผิด (เจอมาแล้ว)

## Dead code / จุดที่ต้องระวังก่อนแก้

- `src/assets/oilrate.js`, `src/stores/rate.js`, `src/stores/counter.ts`, `src/assets/main.css`,
  `src/assets/base.css`, `src/assets/logo.svg` — ไม่ถูก import จากที่ไหน (`main.ts` ไม่ import CSS เลย)
- `public/index.html` เป็น Firebase scaffold; ตอน build ถูก `index.html` ที่ Vite generate ทับใน `dist/`
  (`public/404.html` และ `favicon.ico` ถูก copy ไป `dist/` จริง)
- `UploadProvince.vue` มีบั๊ก: บรรทัดสุดท้าย `console.log('province :>> ', province)` อ้างตัวแปร `province`
  ที่ไม่มีอยู่ → `ReferenceError` หลัง loop จบ (การเขียน Firestore ทำงานไปแล้วก่อนพัง)
- `DieselPriceView.vue` ยังมีบล็อก template "Price Display" ที่ comment ไว้ (แสดงราคาดีเซลเดี่ยว ๆ)
- `filteredPrices` computed ใน `DieselPriceView.vue` ไม่ถูกใช้ที่ใด (เตรียมไว้สำหรับอนาคต)
- `resetFilters()` ใน `DieselPriceView.vue` ไม่ถูกผูกกับปุ่มใดใน template
- `initDieselStore()` ที่ `stores/diesel.js` export ไว้ **ไม่มีใคร import** — หน้าจอเรียก
  `diesel.fetchDieselPrices()` ใน `onMounted` เอง
- `persist: { enabled: false }` ใน `defineStore` ของ `diesel.js` เป็น **no-op** — repo ไม่ได้ติดตั้ง
  pinia persistence plugin ใด ๆ
- `router/index.ts` ยัง `import HomeView` อยู่แม้จะ comment route ทิ้งแล้ว — แต่ **Rollup tree-shake ทิ้งจริง**
  (ตรวจ bundle แล้วไม่มี `"ค่าวิ่งรถออกนอกพื้นที่"`, `"ธรรมยาตรา"`, `dmc.tv` เลย) → เป็นแค่ import ค้าง ไม่กินขนาด
- ⚠️ แต่ **Firestore SDK ถูกรวมเข้า bundle จริง** เพราะ route `/upload` ยังมีชีวิต:
  `UploadProvince` → `firebase-config.ts` → `firebase/firestore` (พบ `firestore` 154 ครั้ง,
  `flueratecar` 3 ครั้ง และ API key ใน bundle) **API key + project id ของ `flueratecar` จึงเปิดเผยต่อสาธารณะ
  พร้อมกับปุ่มเขียน Firestore ที่ไม่มี auth** — ถ้าจะลดขนาด bundle และปิดช่องนี้ ให้ตัด route `/upload` ก่อน
- `DieselPriceView.vue` ใช้ `<v-skeleton-loader>` ซึ่ง**ไม่มีใน Vuetify 3.0.5** (มาใน 3.3+) → console ขึ้น
  `Failed to resolve component: v-skeleton-loader` และตอนโหลดไม่มี skeleton โชว์จริง หน้าธรรมยาตราไม่ใช้ component นี้
- ขนาด build (2026-11-12): JS `index-*.js` **657 kB** (gzip 197 kB) + CSS `index-*.css` **592 kB**
  (gzip 84 kB) + ฟอนต์ Material Design Icons อีก ~2.8 MB (woff2 325 kB / woff 465 kB / ttf 1.03 MB /
  eot 1.03 MB) — build เตือน chunk > 500 kB และยังไม่ได้ tree-shake ไอคอน
  ส่วนหน้าธรรมยาตราแยกเป็น chunk `DhammayatraView-*.js` **233 kB** (gzip 48 kB) โหลดเฉพาะตอนเข้า `/dhammayatra`
  — ส่วนใหญ่คือข้อมูลระยะทาง ถ้าเปลี่ยน route เป็น import ตรงจะไปบวกในบันเดิลหลักทุกหน้า
- `index.html` (title + Open Graph) ยังเป็นชื่องาน V-Star — หน้า `/dhammayatra` แค่ตั้ง `document.title` ตอน runtime
  → ลิงก์ `/dhammayatra` ที่แชร์ใน LINE/Facebook จะยังขึ้นการ์ดชื่อ V-Star
- ⚠️ ยอดที่เบิกได้**เปลี่ยนทุกวันตามราคาบางจาก** ถ้านโยบายเบิกจ่ายเปลี่ยนไปเป็นตรึงราคา ณ วันประกาศ
  ต้องแก้ที่ `currentDieselPrice` ใน `DieselPriceView.vue` และแก้ข้อความ note card ให้ตรงกัน
