import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// ชื่อผลิตภัณฑ์ที่ใช้เป็นฐานคำนวณ (ตรงกับ OilName ที่ API ส่งมา)
const DIESEL_PRODUCT_KEYWORD = 'ไฮดีเซล S'

export const useDieselStore = defineStore('diesel', () => {
   const prices = ref([])
   const loading = ref(true)
   const error = ref(null)
   const lastUpdated = ref(null)   // เวลาที่ fetch สำเร็จ (เวลาเครื่อง client)
   const priceDate = ref(null)     // วันที่ราคามีผล จาก API (OilPriceDate เช่น "08/09/2569")
   const priceRemark = ref(null)   // ข้อความ "ราคามีผล ณ วันที่ ..." จาก API (OilRemark2)
   const isFallback = ref(false)   // true = ใช้ราคาสำรองจาก Cloud Function ไม่ใช่ราคาสด

   const currentDieselPrice = computed(() => {
      const diesel = prices.value.find(p => p.product_th?.includes(DIESEL_PRODUCT_KEYWORD))
      return diesel || null
   })

   // Cloud Function จะส่ง object เดี่ยว { price, isFallback } มาแทน array เมื่อ upstream ล้มเหลว
   function applyFallbackPrice(data) {
      prices.value = [{
         product_id: 0,
         product_th: DIESEL_PRODUCT_KEYWORD,
         price: Number(data.price),
         diff_price: 0,
         date_update: null
      }]
      isFallback.value = true
      priceDate.value = null
      priceRemark.value = null
      lastUpdated.value = new Date()
      console.warn('⚠️ ใช้ราคาสำรองจาก Cloud Function:', data.price)
   }

   async function fetchDieselPrices() {
      loading.value = true
      error.value = null
      isFallback.value = false

      try {
         // เพิ่ม delay เล็กน้อยเพื่อให้ loading state มีเวลาแสดง
         await new Promise(resolve => setTimeout(resolve, 300))

         // เรียก Cloud Function ผ่าน proxy
         // Dev: ใช้ Vite proxy → localhost
         // Production: เรียก Cloud Function โดยตรง
         const apiUrl = '/api/oil-price'

         console.log('📡 Fetching diesel prices from Cloud Function...')
         const response = await fetch(apiUrl)
         if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
         }

         const data = await response.json()
         console.log('✅ API Response:', data)

         // รูปแบบ fallback จาก Cloud Function (ไม่ใช่ array)
         if (!Array.isArray(data)) {
            if (data && Number.isFinite(Number(data.price))) {
               applyFallbackPrice(data)
               return
            }
            throw new Error('รูปแบบข้อมูลจาก API ไม่ถูกต้อง')
         }

         if (data.length === 0) {
            throw new Error('API returned empty data')
         }

         const apiData = data[0]
         const oilListStr = apiData.OilList

         if (!oilListStr) {
            throw new Error('ไม่พบ OilList ในข้อมูล API')
         }

         let oilList
         try {
            oilList = JSON.parse(oilListStr)
         } catch (parseErr) {
            throw new Error('ไม่สามารถแปลง JSON ข้อมูลราคา: ' + parseErr.message)
         }

         // แปลงข้อมูลให้ตรงกับที่ใช้ใน component
         prices.value = oilList.map((oil, index) => ({
            product_id: index,
            product_th: oil.OilName,
            price: Number(oil.PriceToday),
            diff_price: Number(oil.PriceDifYesterday),
            date_update: apiData.OilPriceDate
         }))

         if (!currentDieselPrice.value) {
            throw new Error(`ไม่พบราคา "${DIESEL_PRODUCT_KEYWORD}" ในข้อมูล API`)
         }

         priceDate.value = apiData.OilPriceDate || null
         priceRemark.value = apiData.OilRemark2 || null
         lastUpdated.value = new Date()
         console.log('✅ Processed prices:', prices.value)
      } catch (err) {
         // ล้างราคาเดิมทิ้ง เพื่อไม่ให้คำนวณด้วยข้อมูลที่เชื่อถือไม่ได้
         prices.value = []
         priceDate.value = null
         priceRemark.value = null
         error.value = err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลราคาดีเซล'
         console.error('Diesel price fetch error:', err)
      } finally {
         loading.value = false
      }
   }

   return {
      prices,
      loading,
      error,
      lastUpdated,
      priceDate,
      priceRemark,
      isFallback,
      currentDieselPrice,
      fetchDieselPrices
   }
}, {
   // ให้ store auto-fetch เมื่อเบิก store ครั้งแรก
   persist: {
      enabled: false
   }
})

// เรียก fetch data ทันที
export function initDieselStore() {
   const diesel = useDieselStore()
   if (diesel.prices.length === 0) {
      diesel.fetchDieselPrices()
   }
   return diesel
}
