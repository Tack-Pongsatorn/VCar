<template>
   <v-parallax class="diesel-view" src="/bg-vstar.jpg">
      <v-container fluid fill-height class="pa-2 pa-sm-4">
         <v-row justify="center" class="mt-3">
            <!-- Search Filters Section -->
            <v-col cols="12" lg="6" md="8" sm="10" class="mb-6">
               <v-card color="white" variant="flat" elevation="8">
                  <v-card-text class="pa-6">
                     <h3 class="text-subtitle1 mb-4 text-center">คำนวนค่าน้ำมันดีเซลที่เบิกเพิ่มได้</h3>
                     <v-form ref="filterForm">
                        <v-row>
                           <v-col cols="12" sm="12">
                              <v-select v-model="provinceSelect" :items="provinces" item-title="name_th"
                                 item-value="name_th" label="จังหวัด" clearable prepend-inner-icon="mdi-map"
                                 variant="outlined" :rules="provinceRules"></v-select>
                           </v-col>
                           <v-col v-if="showDistrictSelect" cols="12" sm="12">
                              <v-select v-model="districtSelect" label="อำเภอ" clearable :items="getAvailableDistricts"
                                 prepend-inner-icon="mdi-map-marker" variant="outlined"
                                 :rules="districtRules"></v-select>
                           </v-col>
                           <v-col cols="12" sm="12">
                              <v-select v-model="vehicleTypeSelect" :items="vehicleTypes" label="ประเภทรถ" clearable
                                 prepend-inner-icon="mdi-bus" variant="outlined" :disabled="isVehicleTypeDisabled"
                                 :rules="vehicleTypeRules"></v-select>
                           </v-col>
                           <v-col cols="12" sm="12">
                              <v-btn color="blue" class="mt-2" block @click="handleSearch" variant="tonal">
                                 ค้นหา
                              </v-btn>
                           </v-col>
                        </v-row>
                     </v-form>
                  </v-card-text>
               </v-card>
            </v-col>

            <!-- Price Display Section -->
            <v-col ref="priceDisplaySection" v-if="showPriceDisplay" cols="12" lg="6" md="8" sm="10">
               <v-card color="white" variant="flat" elevation="8">

                  <!-- Loading State with Skeleton -->
                  <v-card-text v-if="loading" class="pa-8">
                     <v-row class="text-center">
                        <v-col cols="12">
                           <v-skeleton-loader type="heading, heading, text, button" class="mx-auto"></v-skeleton-loader>
                        </v-col>
                     </v-row>
                  </v-card-text>

                  <!-- Error State: ดึงราคาน้ำมันไม่ได้ -->
                  <v-alert v-if="!loading && !hasDieselPrice" type="error" variant="tonal" class="ma-4">
                     <p class="mb-2">ไม่สามารถดึงราคาน้ำมันดีเซลได้ในขณะนี้</p>
                     <p v-if="error" class="text-caption mb-2">({{ error }})</p>
                     <v-btn size="small" color="error" variant="tonal" @click="diesel.fetchDieselPrices()">
                        ลองใหม่
                     </v-btn>
                  </v-alert>

                  <!-- Fallback notice: Cloud Function ส่งราคาสำรองมาแทนราคาสด -->
                  <v-alert v-else-if="!loading && isFallback" type="warning" variant="tonal" class="ma-4">
                     ขณะนี้เชื่อมต่อผู้ให้บริการราคาน้ำมันไม่ได้ ระบบใช้ราคาสำรองในการคำนวณ
                  </v-alert>

                  <!-- Price Display -->
                  <!-- <v-card-text v-if="!loading" class="pa-8">
                     <v-row class="text-center">
                        <v-col cols="12">
                           <p class="text-subtitle2 mb-3">ราคาดีเซล</p>
                           <div class="price-display">
                              <span class="text-h2 font-weight-bold text-primary">
                                 {{ currentDieselPrice?.price?.toFixed(2) }}
                              </span>
                              <span class="text-h5 ml-2">บาท/ลิตร</span>
                           </div>
                        </v-col>
                     </v-row>


                     <v-row class="mt-0 text-center">
                        <v-col cols="12">
                           <p class="text-caption text-grey-darken-1">
                              อัปเดตเมื่อ: {{ formatDate(lastUpdated) }}
                           </p>
                        </v-col>
                     </v-row>


                  </v-card-text> -->





                  <!-- Summary Display -->
                  <v-card-text v-if="!loading && showPriceDisplay && calculateFuelCostResult > 0" class="pa-6 mt-4">
                     <v-row class="text-center">
                        <v-col cols="12">
                           <p class="text-subtitle2 mb-3 font-weight-bold">💰 ค่าน้ำมันที่เบิกเพิ่มได้</p>
                           <div class="price-display">
                              <span class="text-h3 font-weight-bold text-success">
                                 <span class="text-h3 d-inline justify-center">+</span> {{
                                    formatNumberWithComma(calculateFuelCostResult) }}
                              </span>
                              <span class="text-h6 ml-2">บาท</span>
                           </div>
                           <p class="text-title1 mt-3 text-grey-darken-3">
                              ราคา: {{
                                 formatNumberWithComma(currentDieselPrice?.price?.toFixed(2)) }} บาท/ลิตร
                           </p>
                           <p class="text-subtitle2 text-grey-darken-1">
                              เรียกดูเมื่อ {{ formatDate(viewedAt) }} น.
                           </p>
                        </v-col>
                     </v-row>
                  </v-card-text>

                  <v-divider class="mb-4"></v-divider>

                  <v-card-title class="text-center justify-center">
                     ค่าน้ำมันที่เบิกเพิ่มได้ อ้างอิงตามสัดส่วน<br> ราคาน้ำมันดีเซลที่เปลี่ยนแปลงดังนี้
                  </v-card-title>
                  <v-table v-if="!loading && showPriceDisplay" density="compact" height="300px" fixed-header>
                     <thead>
                        <tr>
                           <th class="text-center">ราคาดีเซล (บาท/ลิตร)</th>
                           <th class="text-center">ค่าน้ำมันเพิ่มเติม (บาท)</th>
                        </tr>
                     </thead>
                     <tbody>
                        <tr v-for="item in priceRangeData" :key="item.price">
                           <td class="text-center font-weight-bold">{{ formatNumberWithComma(item.price) }}</td>
                           <td class="text-center">{{ formatNumberWithComma(item.extraCost) }}</td>
                        </tr>
                     </tbody>
                  </v-table>

                  <!-- Note Card -->
                  <v-card v-if="showPriceDisplay" color="warning" variant="tonal" class="ma-4 mt-6">
                     <v-card-text class="text-center pa-4">
                        <p class="text-subtitle2 font-weight-bold mb-2 text-grey-darken-3">
                           📌 ค่าน้ำมันที่เบิกเพิ่มได้ คำนวณจากส่วนต่างของราคาน้ำมันดีเซลที่สูงกว่าราคาฐาน
                           {{ BASE_PRICE }} บาท/ลิตร
                        </p>
                        <p class="text-caption mb-0 text-grey-darken-2">
                           ราคาอ้างอิง: ไฮดีเซล S ราคาขายปลีกเขต กทม. ตามประกาศ
                           <a href="https://oil-price.bangchak.co.th/BcpOilPrice1/th" target="_blank"
                              rel="noopener" class="text-decoration-underline font-weight-bold">บางจาก</a>
                           โดยระบบดึงราคาล่าสุดอัตโนมัติ ยอดที่เบิกได้จึงเปลี่ยนตามราคาน้ำมันในแต่ละวัน
                           (ราคายังไม่รวมภาษีบำรุงท้องถิ่น กทม.)
                        </p>
                     </v-card-text>
                  </v-card>

               </v-card>
            </v-col>
         </v-row>
      </v-container>
   </v-parallax>
</template>

<script setup>
import { useDieselStore } from '@/stores/diesel'
import oilrate from '@/stores/oilrate'
import provinceData from '@/stores/province'
import { computed, onMounted, ref, toRef, watch } from 'vue'

const diesel = useDieselStore()

// ใช้ toRef เพื่อเก็บ reactive reference ให้ยังติด track กับ store
const prices = toRef(diesel, 'prices')
const loading = toRef(diesel, 'loading')
const error = toRef(diesel, 'error')
const lastUpdated = toRef(diesel, 'lastUpdated')
const isFallback = toRef(diesel, 'isFallback')

// ราคาดีเซลอ้างอิงจาก API โดยตรง (ไม่มีการ hardcode)
const currentDieselPrice = toRef(diesel, 'currentDieselPrice')

// มีราคาที่ใช้คำนวณได้จริงหรือไม่ (ใช้ตัดสินใจว่าจะแสดงผลลัพธ์หรือ error)
const hasDieselPrice = computed(() => {
   const price = currentDieselPrice.value?.price
   return Number.isFinite(price) && price > 0
})

// ราคาฐาน (บาท/ลิตร) ส่วนที่เกินจากนี้คือส่วนที่เบิกเพิ่มได้
// ใช้ร่วมกันทั้งในสูตร, ช่วงราคาของตาราง และข้อความ note card
const BASE_PRICE = 33

// Filter variables
const filterForm = ref(null)
const priceDisplaySection = ref(null)
const provinceSelect = ref(null)
const districtSelect = ref(null)
const vehicleTypeSelect = ref(null)
const provinces = ref([])
const vehicleTypes = ref(['รถตู้', 'รถบัสพัดลม', 'รถบัสแอร์1 ชั้น', 'รถบัสแอร์2 ชั้น'])
const showPriceDisplay = ref(false)
const foundDistance = ref(null) // เก็บระยะทางที่ค้นหาได้
const viewedAt = ref(null) // เวลาที่ผู้ใช้กดค้นหา — ใช้ประทับบนผลลัพธ์

// จังหวัดที่ไม่ต้องเลือก อำเภอ
const provinceWithoutDistrict = ref(['กทม.', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ'])

// Get available districts based on selected province from oilrate data
const getAvailableDistricts = computed(() => {
   if (!provinceSelect.value) return []

   const districts = oilrate
      .filter(item => item.province === provinceSelect.value)
      .map(item => item.amphur)
      .filter(amphur => amphur) // กรอง amphur ที่ว่าง
      .filter((value, index, self) => self.indexOf(value) === index) // ลบค่าซ้ำ

   return districts.sort((a, b) => a.localeCompare(b, 'th'))
})

// Check if district fields should be shown
const showDistrictSelect = computed(() => {
   if (!provinceSelect.value) return false
   return !provinceWithoutDistrict.value.includes(provinceSelect.value)
})

// Check if district is required based on province
const isDistrictRequired = computed(() => {
   if (!provinceSelect.value) return false
   return !provinceWithoutDistrict.value.includes(provinceSelect.value)
})

// Check if vehicle type field should be disabled
const isVehicleTypeDisabled = computed(() => {
   return !provinceSelect.value || (showDistrictSelect.value && !districtSelect.value)
})

// Validation rules
const provinceRules = [(v) => !!v || 'กรุณาเลือกจังหวัด']

const districtRules = computed(() => {
   return isDistrictRequired.value
      ? [(v) => !!v || 'กรุณาเลือกอำเภอ']
      : []
})

const vehicleTypeRules = [(v) => !!v || 'กรุณาเลือกประเภทรถ']

// Computed filtered prices
const filteredPrices = computed(() => {
   let filtered = [...diesel.prices]

   // เนื่องจากข้อมูลราคาน้ำมันไม่มีการแบ่งแยกตามจังหวัด
   // ส่วนตัวกรองนี้จะไว้สำหรับการรองรับในอนาคต

   return filtered
})

// Compute the fuel cost based on current selection
const calculateFuelCostResult = computed(() => {
   if (!showPriceDisplay.value || !vehicleTypeSelect.value || !foundDistance.value || !hasDieselPrice.value) {
      return 0
   }

   try {
      return calculateExtraFuelCost(vehicleTypeSelect.value, parseFloat(foundDistance.value), currentDieselPrice.value.price)
   } catch (error) {
      console.error('❌ Error calculating fuel cost:', error)
      return 0
   }
})

// Generate price range from BASE_PRICE to 50 for the table
const priceRangeData = computed(() => {
   const priceList = []
   for (let price = BASE_PRICE; price <= 50; price++) {
      priceList.push({
         price: price,
         extraCost: !showPriceDisplay.value || !vehicleTypeSelect.value || !foundDistance.value
            ? 0
            : calculateExtraFuelCost(vehicleTypeSelect.value, parseFloat(foundDistance.value), price)
      })
   }
   return priceList
})

onMounted(async () => {
   console.log('🔄 DieselPriceView mounted, fetching prices...')
   try {
      await diesel.fetchDieselPrices()
      console.log('✅ Prices loaded:', diesel.prices.length, 'items')
      console.log('📊 Current diesel:', diesel.currentDieselPrice)

      // Load provinces
      provinces.value = provinceData.sort((a, b) =>
         a.name_th.localeCompare(b.name_th, 'th')
      )
   } catch (err) {
      console.error('❌ Error in onMounted:', err)
   }
})

const resetFilters = () => {
   provinceSelect.value = null
   districtSelect.value = null
   vehicleTypeSelect.value = null
   showPriceDisplay.value = false
}

// Watch for province changes and reset district
watch(provinceSelect, (newValue) => {
   if (newValue !== null) {
      districtSelect.value = null
   }
})

const handleSearch = async () => {
   const { valid } = await filterForm.value?.validate()

   // ตรวจสอบข้อมูลให้ครบตามเงื่อนไข
   let isValid = true

   if (!provinceSelect.value) {
      isValid = false
      console.warn('⚠️ กรุณาเลือกจังหวัด')
   }

   // ถ้าจังหวัดต้องการ อำเภอ ให้ตรวจสอบ
   if (isDistrictRequired.value && !districtSelect.value) {
      isValid = false
      console.warn('⚠️ กรุณาเลือกอำเภอ')
   }

   if (!vehicleTypeSelect.value) {
      isValid = false
      console.warn('⚠️ กรุณาเลือกประเภทรถ')
   }

   if (valid && isValid) {
      // ค้นหา distance จาก oilrate data
      const searchResult = oilrate.find(item => {
         const provinceMatch = item.province === provinceSelect.value

         // ถ้าจังหวัดไม่ต้องอำเภอ ให้เทียบแค่ province
         if (provinceWithoutDistrict.value.includes(provinceSelect.value)) {
            return provinceMatch
         }

         // ถ้าต้องอำเภอ ให้เทียบทั้ง province แล้าว amphur
         const amphurMatch = item.amphur === districtSelect.value
         return provinceMatch && amphurMatch
      })

      if (searchResult) {
         foundDistance.value = searchResult.distance
         console.log('🎯 พบข้อมูล:', {
            province: provinceSelect.value,
            amphur: districtSelect.value || 'ไม่ต้องระบุ',
            distance: searchResult.distance,
            vehicleType: vehicleTypeSelect.value
         })
      } else {
         console.warn('⚠️ ไม่พบข้อมูลระยะทางที่ตรงกัน')
         foundDistance.value = null
      }

      viewedAt.value = new Date()
      showPriceDisplay.value = true

      // Scroll to results section
      setTimeout(() => {
         priceDisplaySection.value?.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
   } else {
      showPriceDisplay.value = false
      foundDistance.value = null
   }
}

function calculateExtraFuelCost(vehicleType, distanceKm, fuelPricePerLiter) {
   const distancesAll = distanceKm * 2 // เนื่องจากข้อมูลระยะทางใน oilrate เป็นระยะทางไป-กลับ (ไปและกลับ) เราจึงคูณด้วย 2 เพื่อให้ได้ระยะทางรวม
   const fuelRates = {
      'รถตู้': 10,
      'รถบัสพัดลม': 5.5,
      'รถบัสแอร์1 ชั้น': 4.2,
      'รถบัสแอร์2 ชั้น': 3.2,
   };

   const kmPerLiter = fuelRates[vehicleType];
   if (kmPerLiter === undefined) {
      throw new Error(`ประเภทรถไม่ถูกต้อง: ${vehicleType}`);
   }

   if (fuelPricePerLiter <= BASE_PRICE) {
      return 0;
   }

   const litersUsed = distancesAll / kmPerLiter;
   const extraCost = litersUsed * (fuelPricePerLiter - BASE_PRICE);

   return Math.ceil(extraCost)
}

const formatDate = (date) => {
   return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
   }).format(date || new Date())
}

const formatNumberWithComma = (number) => {
   if (number === null || number === undefined) return '0'
   return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
</script>

<style scoped>
.diesel-view {
   min-height: 100vh;
   background-size: cover;
   background-position: center;
   background-attachment: fixed;
   display: flex;
   align-items: flex-start;
   justify-content: center;
   overflow-y: auto;
   overflow-x: hidden;
   padding-top: 8px;
}

@media (max-width: 600px) {
   .diesel-view {
      background-attachment: scroll;
   }
}

/* ปกแนวตั้ง: v-parallax บังคับ object-fit: cover จึง crop บน-ล่าง
   ยึดขอบบนไว้ให้เห็นชื่องาน + โลโก้
   หมายเหตุ: .diesel-view เป็น root element เอง ต้องอยู่นอก :deep() ไม่งั้น selector ไม่ match */
.diesel-view :deep(.v-img__img) {
   object-position: top center;
}

.price-display {
   display: flex;
   align-items: baseline;
   justify-content: center;
}

:deep(.v-table) {
   font-size: 0.875rem;
}

:deep(.v-table tbody tr) {
   height: 8px;
}

:deep(.v-table td),
:deep(.v-table th) {
   padding: 8px 16px;
}
</style>
