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
npm run type-check       # vue-tsc --noEmit (ตรวจแค่ไฟล์ .ts/.vue ที่เป็น TS)
npm run deploy           # firebase deploy (hosting + functions)
npm run deploy-hosting   # เฉพาะ hosting
npm run deploy-functions # เฉพาะ functions (ต้อง npm install ใน functions/ ก่อน)
```

ไม่มี test runner, linter หรือ formatter ใน repo นี้

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

ใช้ `createWebHistory` คู่กับ hosting rewrite `** → /index.html`

### สองเจเนอเรชันของการคิดราคา

ระบบมีตรรกะการคำนวณ 2 แบบอยู่ในโค้ดพร้อมกัน แต่**ใช้งานจริงแบบที่ 2**

1. **`HomeView.vue` (ของเดิม, ไม่ได้ผูก route แล้ว)** — เรทเหมาจ่ายต่อจังหวัด
   อ่านจาก Firestore collection `rateCar4` doc = ชื่อจังหวัด → field `van` / `bus`
   ใช้ Options API, import `db` จาก `firebase-config.ts` โดยตรง

2. **`DieselPriceView.vue` (ปัจจุบัน)** — คำนวณจากระยะทาง × อัตราสิ้นเปลือง × ส่วนต่างราคาดีเซล
   ใช้ `<script setup>` + Pinia store ไม่แตะ Firestore

## Data flow ของราคาน้ำมัน

```
DieselPriceView onMounted
  └─► useDieselStore().fetchDieselPrices()      src/stores/diesel.js
        └─► GET /api/oil-price
              ├─ dev:  Vite proxy (vite.config.ts) ─► https://oil-price.bangchak.co.th/ApiOilPrice2/th
              └─ prod: hosting rewrite (firebase.json) ─► Cloud Function `getOilPrice`
                        └─► functions/index.js ─► Bangchak API (fallback 38.94 ถ้า error)
```

รูปแบบ response ที่ต้องระวัง: API คืน **array** และ `data[0].OilList` เป็น **JSON string** ต้อง `JSON.parse` ซ้อนอีกชั้น
แต่ละรายการมี `OilName`, `PriceToday` (number), `PriceDifYesterday`
วันที่อยู่ที่ `data[0].OilPriceDate` (พ.ศ. รูปแบบ `DD/MM/YYYY`) และข้อความอ่านง่ายที่ `data[0].OilRemark2`
(เช่น `"ราคามีผล ณ วันที่ 9 ก.ย. 69 เวลา 05.00 น."`)

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
| `priceDate` | `OilPriceDate` จาก API |
| `priceRemark` | `OilRemark2` จาก API — ใช้แสดงวันที่ราคามีผลใน UI |
| `isFallback` | `true` เมื่อได้ราคาสำรองจาก Cloud Function ไม่ใช่ราคาสด |

การจัดการความล้มเหลว (ทุกเคสทดสอบแล้ว):

1. upstream ปกติ → ใช้ `PriceToday` ของ `ไฮดีเซล S`
2. Cloud Function เรียก Bangchak ไม่ได้ → ส่ง `{ price, isFallback: true }` (**object ไม่ใช่ array**)
   store ตรวจ `!Array.isArray(data)` แล้วสร้างรายการเดียวจาก `price` + ตั้ง `isFallback = true` → UI ขึ้น alert สีเหลือง
3. HTTP error / JSON เพี้ยน / ไม่มี `ไฮดีเซล S` → ล้าง `prices` ตั้ง `error` → UI ขึ้น alert แดง + ปุ่ม "ลองใหม่"
   (ไม่แสดงผลลัพธ์ 0 เงียบ ๆ เหมือนเดิม)

ตารางช่วงราคายังแสดงได้ปกติแม้ดึงราคาไม่ได้ เพราะไม่ได้พึ่ง `currentDieselPrice`

note card ท้ายหน้าอ้างอิงแหล่งราคาเป็น **บางจาก** (`https://oil-price.bangchak.co.th/BcpOilPrice1/th`)
และระบุชัดว่ายอดเปลี่ยนตามราคารายวัน — ต้องแก้ข้อความนี้ด้วยถ้าเปลี่ยนแหล่งราคาหรือกลับไปตรึงราคา

> ⚠️ `FALLBACK_PRICE` ใน `functions/index.js` เป็นราคาสำรอง **ที่ต้องอัปเดตมือเป็นระยะ**
> และการแก้ค่านี้ต้อง `npm run deploy-functions` จึงจะมีผล

## สูตรคำนวณ (`calculateExtraFuelCost` ใน DieselPriceView.vue)

```
distancesAll = distance × 2            // distance ใน oilrate เป็นเที่ยวเดียว จึงคูณ 2 เป็นไป-กลับ
ถ้า price ≤ BASE_PRICE  ─► 0
extraCost = Math.ceil( (distancesAll / kmPerLiter) × (price − BASE_PRICE) )
```

`BASE_PRICE = 33` ประกาศไว้ระดับ top-level ของ `<script setup>` จุดเดียว
ใช้ร่วมกันทั้งในสูตร, ช่วงราคาของตาราง (`priceRangeData` เริ่มที่ `BASE_PRICE` ถึง 50) และข้อความ note card
→ แก้ราคาฐานที่เดียวแล้วเปลี่ยนตามกันทั้งหมด

อัตราสิ้นเปลือง (km/ลิตร) — key ต้องตรงตัวอักษรกับ `vehicleTypes`:

| ประเภทรถ | km/L |
|---|---|
| รถตู้ | 10 |
| รถบัสพัดลม | 5.5 |
| รถบัสแอร์1 ชั้น | 4.2 |
| รถบัสแอร์2 ชั้น | 3.2 |

ตารางในหน้าจอไล่ราคา `BASE_PRICE`–50 บาท/ลิตร ด้วยสูตรเดียวกัน

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

### ตรรกะจังหวัด/อำเภอ

- `provinceWithoutDistrict = ['กทม.', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ']` → ซ่อน select อำเภอ
  และ match ระยะทางด้วย `province` เพียงตัวเดียว จังหวัดอื่นต้อง match ทั้ง `province` + `amphur`
- รายการอำเภอ derive จาก `oilrate` ตามจังหวัดที่เลือก (unique + sort ด้วย `localeCompare(..., 'th')`)
- ⚠️ dropdown จังหวัดมาจาก `province.js` (77 จังหวัด) แต่ระยะทางมาจาก `oilrate.js`
  จังหวัดที่ไม่มีใน `oilrate` จะหาระยะทางไม่เจอ → `foundDistance = null` → ผลลัพธ์ 0 โดยไม่แจ้ง user
  (แจ้งแค่ `console.warn`) ถ้าเพิ่มข้อมูลจังหวัด ต้องเพิ่มใน `oilrate.js` ด้วย
- ชื่อกรุงเทพใน `oilrate`/`province.js` คือ `"กทม."` แต่ `HomeView.provinceWithout` เขียนว่า `"กรุงเทพมหานคร"` — ชื่อไม่ตรงกัน

## Firebase

- **Deploy target**: `.firebaserc` → project `mbus-rate`
- **Firestore client**: `firebase-config.ts` ชี้ project `flueratecar` (ต่างจาก deploy target)
  API key อยู่ใน repo ตรง ๆ; ใช้ **Firebase SDK v8 namespaced API** (`firebase/app` + `firebase/firestore`,
  เรียกแบบ `db.collection('rateCar4').doc(x).get()`) — **ห้ามผสมกับ v9 modular syntax**
- **Hosting**: serve `./dist`, rewrite `/api/oil-price` → function `getOilPrice`, ที่เหลือ `** → /index.html`
- **Functions**: `functions/` เป็น package แยก (`npm install` ของตัวเอง), Node 20,
  `firebase-functions` v5 ใช้ `onRequest` จาก `firebase-functions/v2/https` + `cors`
  ตอบ 200 พร้อม `{ price, isFallback: true }` และ header `X-Fallback` เมื่อ upstream ล้มเหลว
  cache `public, max-age=300`
- `firestore.rules` / `firestore.indexes.json` ถูกลบออกจาก repo แล้ว (commit `5f73d63`) — กฎ Firestore
  ไม่ได้ถูกจัดการจากที่นี่
- `.firebase/hosting.ZGlzdA.cache` เป็น deploy cache ที่ถูก commit ติดมา (ไม่ต้องแก้มือ)

## Conventions

- **Indentation ไม่สม่ำเสมอ**: ไฟล์ใหม่ (`main.ts`, `vite.config.ts`, `diesel.js`, `DieselPriceView.vue`,
  `router/index.ts`) ใช้ **3 spaces**; ไฟล์เก่า (`HomeView.vue`, `province.js`, `App.vue`) ใช้ **2 spaces**
  → ยึดตามไฟล์ที่กำลังแก้
- ไฟล์ใหม่เขียนเป็น **JavaScript** ไม่ใช่ TypeScript (`.js` store, `<script setup>` ไม่มี `lang="ts"`)
  แม้โปรเจกต์จะ config TS ไว้ — `type-check` จึงไม่ครอบไฟล์เหล่านี้
- alias `@` → `./src` (ตั้งไว้ทั้งใน `vite.config.ts` และ `tsconfig.json`)
  แต่โค้ดบางส่วนยัง import แบบ relative (`../stores/province`, `../../firebase-config`) — ใช้ทั้งสองแบบผสมกัน
- comment / log / ข้อความ UI เป็นภาษาไทย, `console.log` ใช้ emoji นำหน้า (`📡 ✅ ⚠️ ❌ 🎯`) และยังเปิดอยู่ใน production
- Vuetify components auto-import ผ่าน `vite-plugin-vuetify` (ไม่ต้อง import เอง)
- font: Noto Sans Thai โหลดจาก Google Fonts ใน `App.vue` และบังคับ `* { font-family: ... !important }`
- รูปพื้นหลัง/โลโก้ hotlink จาก external URL (twimg, dmc.tv, dhammakaya.or.th)

## Dead code / จุดที่ต้องระวังก่อนแก้

- `src/assets/oilrate.js`, `src/stores/rate.js`, `src/stores/counter.ts`, `src/assets/main.css`,
  `src/assets/base.css`, `src/assets/logo.svg` — ไม่ถูก import จากที่ไหน (`main.ts` ไม่ import CSS เลย)
- `public/index.html` เป็น Firebase scaffold; ตอน build ถูก `index.html` ที่ Vite generate ทับใน `dist/`
  (`public/404.html` และ `favicon.ico` ถูก copy ไป `dist/` จริง)
- `UploadProvince.vue` มีบั๊ก: บรรทัดสุดท้าย `console.log('province :>> ', province)` อ้างตัวแปร `province`
  ที่ไม่มีอยู่ → `ReferenceError` หลัง loop จบ (การเขียน Firestore ทำงานไปแล้วก่อนพัง)
- `DieselPriceView.vue` ยังมีบล็อก template "Price Display" ที่ comment ไว้ (แสดงราคาดีเซลเดี่ยว ๆ)
- `filteredPrices` computed ใน `DieselPriceView.vue` ไม่ถูกใช้ที่ใด (เตรียมไว้สำหรับอนาคต)
- bundle เดียวขนาด ~653 kB (build เตือน chunk > 500 kB) ยังไม่ทำ code splitting
- ⚠️ ยอดที่เบิกได้**เปลี่ยนทุกวันตามราคาบางจาก** ถ้านโยบายเบิกจ่ายเปลี่ยนไปเป็นตรึงราคา ณ วันประกาศ
  ต้องแก้ที่ `currentDieselPrice` ใน `DieselPriceView.vue` และแก้ข้อความ note card ให้ตรงกัน
