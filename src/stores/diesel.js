import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useDieselStore = defineStore('diesel', () => {
   const prices = ref([])
   const loading = ref(true)
   const error = ref(null)
   const lastUpdated = ref(null)

   const currentDieselPrice = computed(() => {
      const diesel = prices.value.find(p => p.product_th?.includes('ไฮดีเซล S'))
      return diesel || null
   })

   async function fetchDieselPrices() {
      loading.value = true
      error.value = null

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

         if (Array.isArray(data) && data.length > 0) {
            const apiData = data[0]
            const oilListStr = apiData.OilList

            if (oilListStr) {
               try {
                  const oilList = JSON.parse(oilListStr)
                  // แปลงข้อมูลให้ตรงกับที่ใช้ใน component
                  prices.value = oilList.map((oil, index) => ({
                     product_id: index,
                     product_th: oil.OilName,
                     price: oil.PriceToday,
                     diff_price: oil.PriceDifYesterday,
                     date_update: apiData.OilPriceDate
                  }))
                  console.log('✅ Processed prices:', prices.value)
                  lastUpdated.value = new Date()
               } catch (parseErr) {
                  throw new Error('ไม่สามารถแปลง JSON ข้อมูลราคา: ' + parseErr.message)
               }
            } else {
               throw new Error('ไม่พบ OilList ในข้อมูล API')
            }
         } else {
            throw new Error('API returned empty data')
         }
      } catch (err) {
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
