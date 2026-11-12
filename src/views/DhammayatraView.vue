<template>
   <div class="dy">
      <header class="dy-header">
         <div class="dy-wrap">
            <p class="dy-eyebrow">งานธรรมยาตรา 2570</p>
            <h1 class="dy-title">คำนวณค่ารถที่เบิกได้</h1>
            <p class="dy-lead">{{ SCHEDULE_TITLE }}</p>
         </div>
      </header>

      <main class="dy-wrap dy-main">
         <!-- 1. จุดออกรถ -->
         <section class="dy-step" :class="{ 'is-done': origin }">
            <h2 class="dy-step__title">
               <span class="dy-step__no" aria-hidden="true">
                  <i v-if="origin" class="mdi mdi-check"></i><template v-else>1</template>
               </span>
               รถออกจากที่ไหน
            </h2>

            <label class="dy-field">
               <span class="dy-field__label">จังหวัด</span>
               <span class="dy-select">
                  <select v-model="provinceSelect">
                     <option :value="null" disabled>แตะเพื่อเลือกจังหวัด</option>
                     <option v-for="p in provinces" :key="p" :value="p">{{ p }}</option>
                  </select>
                  <i class="mdi mdi-chevron-down" aria-hidden="true"></i>
               </span>
            </label>

            <!-- กทม.: ช่องนี้รวมจุดออกรถทุกเขตไว้เลย ไม่ต้องเลือกเขตก่อนแล้วค่อยเลือกจุด -->
            <label v-if="provinceSelect && pointFirst" class="dy-field">
               <span class="dy-field__label">
                  เขต / จุดออกรถ <span class="dy-muted">({{ points.length }} จุด)</span>
               </span>
               <span class="dy-select">
                  <select v-model="pointKeySelect">
                     <option :value="null" disabled>แตะเพื่อเลือกจุดออกรถ</option>
                     <option v-for="p in points" :key="p.key" :value="p.key">{{ p.label }}</option>
                  </select>
                  <i class="mdi mdi-chevron-down" aria-hidden="true"></i>
               </span>
            </label>

            <!-- จังหวัดอื่น: เลือกอำเภอ แล้วถ้าอำเภอนั้นมีหลายจุดค่อยเลือกจุด (จุดเดียวเลือกให้อัตโนมัติ) -->
            <template v-if="provinceSelect && !pointFirst">
               <label class="dy-field">
                  <span class="dy-field__label">อำเภอ / เขต</span>
                  <span class="dy-select">
                     <select v-model="amphurSelect">
                        <option :value="null" disabled>แตะเพื่อเลือกอำเภอ</option>
                        <option v-for="a in amphurs" :key="a" :value="a">{{ a }}</option>
                     </select>
                     <i class="mdi mdi-chevron-down" aria-hidden="true"></i>
                  </span>
               </label>

               <label v-if="points.length > 1" class="dy-field">
                  <span class="dy-field__label">
                     จุดออกรถ <span class="dy-muted">(อำเภอนี้มี {{ points.length }} จุด)</span>
                  </span>
                  <span class="dy-select">
                     <select v-model="pointKeySelect">
                        <option :value="null" disabled>แตะเพื่อเลือกจุดออกรถ</option>
                        <option v-for="p in points" :key="p.key" :value="p.key">{{ p.label }}</option>
                     </select>
                     <i class="mdi mdi-chevron-down" aria-hidden="true"></i>
                  </span>
               </label>
            </template>
         </section>

         <!-- 2. ประเภทรถ -->
         <section class="dy-step" :class="{ 'is-done': vehicleTypeSelect, 'is-waiting': !origin }">
            <h2 class="dy-step__title">
               <span class="dy-step__no" aria-hidden="true">
                  <i v-if="vehicleTypeSelect" class="mdi mdi-check"></i><template v-else>2</template>
               </span>
               ใช้รถประเภทไหน
            </h2>
            <p v-if="!origin" class="dy-hint">เลือกจุดออกรถในข้อ 1 ก่อน</p>
            <div v-else class="dy-options dy-options--grid" role="radiogroup" aria-label="ประเภทรถ">
               <label v-for="v in VEHICLE_TYPES" :key="v" class="dy-option"
                  :class="{ 'is-selected': vehicleTypeSelect === v }">
                  <input v-model="vehicleTypeSelect" type="radio" name="vehicle" :value="v" class="dy-sr">
                  <span class="dy-option__title">
                     <i class="mdi" :class="v === 'รถตู้' ? 'mdi-van-passenger' : 'mdi-bus'" aria-hidden="true"></i>
                     {{ vehicleLabel(v) }}
                  </span>
                  <span class="dy-option__desc">
                     ราคากลาง {{ origin.prices[v] === null ? '—' : `${money(origin.prices[v])} บาท` }}
                  </span>
               </label>
            </div>
         </section>

         <!-- 3. รูปแบบการร่วมงาน -->
         <section class="dy-step" :class="{ 'is-done': effectiveMode, 'is-waiting': !vehicleTypeSelect }">
            <h2 class="dy-step__title">
               <span class="dy-step__no" aria-hidden="true">
                  <i v-if="effectiveMode" class="mdi mdi-check"></i><template v-else>3</template>
               </span>
               มาร่วมงานแบบไหน
            </h2>
            <p v-if="!origin || !vehicleTypeSelect" class="dy-hint">เลือกประเภทรถในข้อ 2 ก่อน</p>

            <div v-else-if="eligibility === 'forced'" class="dy-note dy-note--info">
               <i class="mdi mdi-information-outline" aria-hidden="true"></i>
               <span>
                  จุดออกรถนี้อยู่ไกล — ราคากลาง{{ vehicleLabel(vehicleTypeSelect) }}
                  <strong>{{ money(standardPrice) }} บาท</strong> เกินเกณฑ์ {{ money(priceLimit) }} บาท
                  ระบบจึงคิดค่ารถแบบ <strong>พักค้าง</strong> — เลือกรอบพักค้างในข้อ 4
               </span>
            </div>

            <template v-else>
               <p v-if="eligibility === 'unknown'" class="dy-note dy-note--info">
                  <i class="mdi mdi-information-outline" aria-hidden="true"></i>
                  <span>จุดนี้ยังไม่มีราคากลางของ{{ vehicleLabel(vehicleTypeSelect) }} จึงเลือกได้ทั้งสองแบบ</span>
               </p>
               <div class="dy-options" role="radiogroup" aria-label="รูปแบบการร่วมงาน">
                  <label class="dy-option" :class="{ 'is-selected': modeSelect === MODE_ROUND_TRIP }">
                     <input v-model="modeSelect" type="radio" name="mode" :value="MODE_ROUND_TRIP" class="dy-sr">
                     <span class="dy-option__title">ไป-กลับ</span>
                     <span class="dy-option__desc">มาแล้วกลับในวันเดียว เลือกได้ 1 วัน</span>
                  </label>
                  <label class="dy-option" :class="{ 'is-selected': modeSelect === MODE_OVERNIGHT }">
                     <input v-model="modeSelect" type="radio" name="mode" :value="MODE_OVERNIGHT" class="dy-sr">
                     <span class="dy-option__title">พักค้าง</span>
                     <span class="dy-option__desc">พักที่วัดพระธรรมกาย เลือกตามรอบพักค้าง</span>
                  </label>
               </div>
            </template>
         </section>

         <!-- 4. ไป-กลับ: เลือกกิจกรรมวันเดียว / พักค้าง: เลือกรอบพักค้าง -->
         <section class="dy-step" :class="{ 'is-done': result, 'is-waiting': !effectiveMode }">
            <h2 class="dy-step__title">
               <span class="dy-step__no" aria-hidden="true">
                  <i v-if="result" class="mdi mdi-check"></i><template v-else>4</template>
               </span>
               {{ effectiveMode === MODE_OVERNIGHT ? 'เลือกรอบพักค้าง' : 'มาร่วมกิจกรรมไหนบ้าง' }}
            </h2>
            <p v-if="!effectiveMode" class="dy-hint">เลือกแบบการร่วมงานในข้อ 3 ก่อน</p>

            <!-- พักค้าง: เลือกรอบ (ร่วมทุกกิจกรรมในวันที่พัก) -->
            <template v-else-if="effectiveMode === MODE_OVERNIGHT">
               <div class="dy-options" role="radiogroup" aria-label="รอบพักค้าง">
                  <label v-for="r in roundViews" :key="r.id" class="dy-option"
                     :class="{ 'is-selected': roundSelect === r.id }">
                     <input v-model="roundSelect" type="radio" name="round" :value="r.id" class="dy-sr">
                     <span class="dy-option__title">{{ r.title }}</span>
                     <span v-for="line in r.lines" :key="line.date" class="dy-option__desc dy-round__line">
                        <strong>{{ line.dateLabel }}</strong> {{ line.text }}
                     </span>
                     <span v-if="r.optionalNote" class="dy-option__desc dy-round__optional">{{ r.optionalNote }}</span>
                  </label>
               </div>

               <!-- รอบที่มีวันไม่บังคับ: ถามว่าอยู่ถึงวันไหน -->
               <template v-if="selectedRound && selectedRound.optionalDays.length">
                  <p class="dy-subtitle">อยู่ถึงวันไหน</p>
                  <div class="dy-options" role="radiogroup" aria-label="อยู่ถึงวันไหน">
                     <label v-for="(end, k) in roundEndOptionsView" :key="end.date" class="dy-option"
                        :class="{ 'is-selected': effectiveRoundEnd === end.date }">
                        <input v-model="roundEndSelect" type="radio" name="round-end" :value="end.date" class="dy-sr">
                        <span class="dy-option__title">{{ end.title }}</span>
                        <span class="dy-option__desc">{{ k === 0 ? 'มาเฉพาะวันที่บังคับ' : end.desc }}</span>
                     </label>
                  </div>
               </template>
            </template>

            <!-- ไป-กลับ: ติ๊กกิจกรรมได้วันเดียว -->
            <template v-else>
               <p class="dy-hint dy-hint--plain">
                  ไป-กลับเลือกได้ 1 วัน (ในวันนั้นเลือกได้หลายกิจกรรม) · แตะกิจกรรมวันอื่นจะเปลี่ยนเป็นวันนั้นแทน
               </p>
               <div v-for="day in scheduleByDay" :key="day.date" class="dy-day">
                  <p class="dy-day__date">
                     {{ formatFullDate(day.date) }}
                     <span v-if="DAY_NOTES[day.date]" class="dy-day__note">{{ DAY_NOTES[day.date] }}</span>
                  </p>
                  <label v-for="a in day.activities" :key="a.id" class="dy-check"
                     :class="{ 'is-selected': activitySelect.includes(a.id) }">
                     <input type="checkbox" :value="a.id" class="dy-sr" :checked="activitySelect.includes(a.id)"
                        @change="toggleActivity(a, $event.target.checked)">
                     <span class="dy-check__box" aria-hidden="true"><i class="mdi mdi-check"></i></span>
                     <span class="dy-check__text">
                        <span class="dy-check__title">{{ a.name }}</span>
                        <span class="dy-check__desc">{{ VENUES[a.venue] }}</span>
                     </span>
                  </label>
               </div>
            </template>

            <p v-if="selectionError" class="dy-note dy-note--error" role="alert">
               <i class="mdi mdi-alert-circle-outline" aria-hidden="true"></i>
               <span>{{ selectionError }}</span>
            </p>
         </section>

         <!-- ผลลัพธ์ -->
         <section v-if="result" ref="resultEl" class="dy-result" aria-live="polite">
            <p v-if="diesel.loading" class="dy-note dy-note--info">
               <i class="mdi mdi-progress-clock" aria-hidden="true"></i>
               <span>กำลังดึงราคาน้ำมันล่าสุด...</span>
            </p>
            <div v-else-if="fuelPrice === null" class="dy-note dy-note--error">
               <i class="mdi mdi-alert-circle-outline" aria-hidden="true"></i>
               <span>
                  ดึงราคาน้ำมันไม่ได้ในขณะนี้ จึงยังคิดค่าน้ำมันไม่ได้
                  <button type="button" class="dy-btn dy-btn--small" @click="diesel.fetchDieselPrices()">ลองใหม่</button>
               </span>
            </div>
            <p v-else-if="diesel.isFallback" class="dy-note dy-note--warn">
               <i class="mdi mdi-alert-outline" aria-hidden="true"></i>
               <span>เชื่อมต่อแหล่งราคาน้ำมันไม่ได้ ระบบใช้ราคาสำรองคำนวณแทน</span>
            </p>

            <h2 class="dy-result__heading">ค่ารถที่เบิกได้</h2>
            <p class="dy-total">
               <span class="dy-total__num">{{ money(result.total) }}</span>
               <span class="dy-total__unit">บาท</span>
            </p>
            <p v-if="!result.complete" class="dy-incomplete">
               ยอดนี้ยังไม่รวม{{ missingLabels }} เพราะไม่มีข้อมูล
            </p>
            <p class="dy-summary">{{ originLabel }} · {{ vehicleLabel(vehicleTypeSelect) }} · {{ modeSummary }}</p>

            <table class="dy-breakdown">
               <tbody>
                  <tr v-for="g in groups" :key="g.no">
                     <th scope="row">
                        {{ g.label }}
                        <span v-if="g.note" class="dy-breakdown__note">{{ g.note }}</span>
                     </th>
                     <td :class="{ 'is-missing': g.amount === null }">
                        {{ g.amount === null ? 'ไม่มีข้อมูล' : money(g.amount) }}
                     </td>
                  </tr>
               </tbody>
               <tfoot>
                  <tr>
                     <th scope="row">รวม</th>
                     <td>{{ money(result.total) }}</td>
                  </tr>
               </tfoot>
            </table>

            <details class="dy-details">
               <summary>
                  <span>ดูวิธีคำนวณ</span>
                  <i class="mdi mdi-chevron-down" aria-hidden="true"></i>
               </summary>
               <ol class="dy-details__list">
                  <li v-for="(line, i) in result.lines" :key="i">
                     <span class="dy-details__label">{{ line.label }}</span>
                     <span class="dy-details__formula">{{ line.formula }}</span>
                     <span class="dy-details__amount">{{ line.amount === null ? '—' : `${money(line.amount)} บาท` }}</span>
                  </li>
               </ol>
               <p class="dy-details__foot">
                  ค่าน้ำมันที่เพิ่มขึ้น คิดเฉพาะส่วนที่ราคาน้ำมันเกิน {{ FUEL_BASE_PRICE }} บาท/ลิตร ·
                  ค่าวิ่งรถออกนอกพื้นที่ คิดจากระยะทางที่พื้นที่จัดงานไกลกว่าวัดพระธรรมกาย
               </p>
            </details>

            <p v-if="fuelPrice !== null" class="dy-source">
               ราคาน้ำมันไฮดีเซล S {{ fuelPrice.toFixed(2) }} บาท/ลิตร จาก
               <a href="https://oil-price.bangchak.co.th/BcpOilPrice1/th" target="_blank" rel="noopener">บางจาก</a>
               (อัปเดตอัตโนมัติ ยอดจึงเปลี่ยนตามราคาน้ำมันแต่ละวัน) · คำนวณเมื่อ {{ formatDateTime(viewedAt) }} น.
            </p>

            <button type="button" class="dy-btn dy-btn--ghost dy-btn--block" @click="resetAll">
               <i class="mdi mdi-restart" aria-hidden="true"></i> เริ่มคำนวณใหม่
            </button>
         </section>
      </main>

      <!-- แถบยอดรวมด้านล่าง: โชว์เมื่อคำนวณได้แล้วแต่ผลลัพธ์ยังไม่อยู่ในจอ -->
      <div v-if="result && !resultInView" class="dy-sticky">
         <div class="dy-wrap dy-sticky__inner">
            <span class="dy-sticky__text">ค่ารถที่เบิกได้ <strong>{{ money(result.total) }}</strong> บาท</span>
            <button type="button" class="dy-btn dy-btn--primary" @click="scrollToResult">ดูรายละเอียด</button>
         </div>
      </div>
   </div>
</template>

<script setup>
import {
   BOOKABLE_ACTIVITIES,
   DAY_NOTES,
   FUEL_BASE_PRICE,
   OVERNIGHT_ROUNDS,
   POINT_FIRST_PROVINCES,
   SCHEDULE_TITLE,
   STANDARD_PRICE_LIMIT,
   VENUES,
} from '@/config/dhammayatra'
import { useDieselStore } from '@/stores/diesel'
import distances from '@/stores/dhammayatraDistance'
import standardPrices from '@/stores/dhammayatraStandardPrice'
import {
   MODE_OVERNIGHT,
   MODE_ROUND_TRIP,
   buildOrigins,
   calculateFare,
   eligibilityOf,
   findRound,
   findStandardPrice,
   roundEndOptions,
   validateSelection,
   vehicleClassOf,
} from '@/utils/dhammayatraFare'
import { VEHICLE_TYPES } from '@/utils/fuel'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const PAGE_TITLE = 'คำนวณค่ารถงานธรรมยาตรา'

// ชื่อหัวข้อในตารางผลลัพธ์ (ตามเลขข้อในตัวคำนวณ) — ใช้คำที่ผู้ใช้อ่านเข้าใจ ไม่อ้างเลขข้อของเอกสาร
const GROUP_LABELS = {
   1: 'ราคากลาง',
   2: 'ค่าน้ำมันที่เพิ่มขึ้น',
   3: 'ค่าวิ่งรถออกนอกพื้นที่',
   4: 'ค่าพักค้าง',
   5: 'ค่าวิ่งรถจากวัดไปที่จัดงาน',
   6: 'ค่าร่วมงาน 2 กิจกรรมในวันเดียว',
}
// ข้อที่วิธีคิดสั้นพอจะโชว์ใต้หัวข้อได้เลย (ข้อ 2, 3 ยาว ดูใน "วิธีคำนวณ")
const SHORT_FORMULA_GROUPS = [1, 4, 5, 6]

const diesel = useDieselStore()

const provinceSelect = ref(null)
const amphurSelect = ref(null)
const pointKeySelect = ref(null)    // `${อำเภอ}|${จุดออกรถ}` — ชื่อจุดอย่างเดียวอาจซ้ำข้ามอำเภอได้
const vehicleTypeSelect = ref(null)
const modeSelect = ref(null)        // เลือกเองได้เมื่อราคากลางไม่เกินเกณฑ์ (หรือไม่มีราคากลาง)
const activitySelect = ref([])      // ไป-กลับ: id กิจกรรมที่ติ๊ก (วันเดียว)
const roundSelect = ref(null)       // พักค้าง: id รอบใน OVERNIGHT_ROUNDS
const roundEndSelect = ref(null)    // พักค้าง: อยู่ถึงวันไหน (เฉพาะรอบที่มีวันไม่บังคับ; null = วันสุดท้ายที่บังคับ)
const viewedAt = ref(new Date())
const resultEl = ref(null)
const resultInView = ref(false)

const origins = buildOrigins(standardPrices, distances)

const byThai = (a, b) => a.localeCompare(b, 'th')
const provinces = [...new Set(origins.map(o => o.province))].sort(byThai)

const amphurs = computed(() => {
   if (!provinceSelect.value) return []
   return [...new Set(origins.filter(o => o.province === provinceSelect.value).map(o => o.amphur))].sort(byThai)
})

// จังหวัดใน POINT_FIRST_PROVINCES (กทม.): ช่องที่สองรวมจุดออกรถทุกเขต ไม่ต้องเลือกเขตก่อน
const pointFirst = computed(() => POINT_FIRST_PROVINCES.includes(provinceSelect.value))

const pointKey = (o) => `${o.amphur}|${o.point}`

// ชื่อจุดที่ไม่ได้บอกเขตไว้ (เช่น "สวนหลวง ร.9") เติมชื่อเขตต่อท้าย เพราะรายการรวมทุกเขต
function pointFirstLabel(o) {
   if (o.point.includes(o.amphur) || o.point.includes('เขต')) return o.point
   return `${o.point} (เขต${o.amphur})`
}

// กทม.: จุดออกรถทั้งจังหวัด / จังหวัดอื่น: จุดออกรถของอำเภอที่เลือก
const points = computed(() => {
   if (!provinceSelect.value) return []
   if (pointFirst.value) {
      return origins
         .filter(o => o.province === provinceSelect.value)
         .map(o => ({ key: pointKey(o), label: pointFirstLabel(o) }))
         .sort((a, b) => byThai(a.label, b.label))
   }
   if (!amphurSelect.value) return []
   return origins
      .filter(o => o.province === provinceSelect.value && o.amphur === amphurSelect.value)
      .map(o => ({ key: pointKey(o), label: o.point }))
      .sort((a, b) => byThai(a.label, b.label))
})

const origin = computed(() =>
   origins.find(o => o.province === provinceSelect.value && pointKey(o) === pointKeySelect.value) || null
)

const originLabel = computed(() => {
   if (!origin.value) return ''
   const { province, amphur, point } = origin.value
   return point === amphur ? `${province} / ${amphur}` : `${province} / ${amphur} / ${point}`
})

const fuelPrice = computed(() => {
   const price = diesel.currentDieselPrice?.price
   return Number.isFinite(price) && price > 0 ? price : null
})

const standardPrice = computed(() =>
   origin.value && vehicleTypeSelect.value ? findStandardPrice(origin.value, vehicleTypeSelect.value) : null
)

const eligibility = computed(() =>
   origin.value && vehicleTypeSelect.value ? eligibilityOf(standardPrice.value, vehicleTypeSelect.value) : null
)

const priceLimit = computed(() =>
   vehicleTypeSelect.value ? STANDARD_PRICE_LIMIT[vehicleClassOf(vehicleTypeSelect.value)] : null
)

// รูปแบบที่ใช้คำนวณจริง — เกินเกณฑ์บังคับพักค้าง
const effectiveMode = computed(() => {
   if (!eligibility.value) return null
   return eligibility.value === 'forced' ? MODE_OVERNIGHT : modeSelect.value
})

const scheduleByDay = computed(() => {
   const days = new Map()
   BOOKABLE_ACTIVITIES.forEach(a => {
      if (!days.has(a.date)) days.set(a.date, [])
      days.get(a.date).push(a)
   })
   return [...days.entries()].map(([date, activities]) => ({ date, activities }))
})

const activityDate = Object.fromEntries(BOOKABLE_ACTIVITIES.map(a => [a.id, a.date]))

// ติ๊ก/เอาออก — ไป-กลับเลือกได้วันเดียว: ติ๊กกิจกรรมวันอื่น = เปลี่ยนเป็นวันนั้น (ล้างวันเดิมให้เลย ไม่ต้องไปยกเลิกเอง)
function toggleActivity(a, checked) {
   let next = activitySelect.value.filter(id => id !== a.id)
   if (checked) {
      next.push(a.id)
      if (effectiveMode.value === MODE_ROUND_TRIP) {
         next = next.filter(id => activityDate[id] === a.date)
      }
   }
   activitySelect.value = next
}

// ---------- รอบพักค้าง ----------
const dayNum = (iso) => Number(iso.slice(8))
const shortDay = (iso) => new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
   .format(new Date(`${iso}T00:00:00`))

// กิจกรรมจัดรถของแต่ละวัน เป็นข้อความสั้น เช่น "สังฆทาน, จุดประทีป (โลตัสแลนด์)"
// วันแรกของรอบที่ไม่มีกิจกรรม = วันเดินทางมาถึง (เช่น 1 ม.ค.)
function dayActivityText(iso, isArrival = false) {
   const acts = BOOKABLE_ACTIVITIES.filter(a => a.date === iso)
   if (!acts.length) return isArrival ? 'เดินทางมาถึงวัด' : 'ไม่มีกิจกรรม'
   const byVenue = new Map()
   acts.forEach(a => {
      if (!byVenue.has(a.venue)) byVenue.set(a.venue, [])
      byVenue.get(a.venue).push(a.name)
   })
   return [...byVenue.entries()].map(([v, names]) => `${names.join(', ')} (${VENUES[v]})`).join(' · ')
}

const roundViews = OVERNIGHT_ROUNDS.map(r => {
   const first = r.days[0]
   const last = r.days[r.days.length - 1]
   const opt = r.optionalDays
   return {
      id: r.id,
      title: `รอบ ${dayNum(first)}–${dayNum(last)} มกราคม`,
      lines: r.days.map((d, i) => ({ date: d, dateLabel: shortDay(d), text: dayActivityText(d, i === 0) })),
      optionalNote: opt.length
         ? `อยู่ต่อได้ถึง ${opt.map(d => `${dayNum(d)}`).join(', ')} ม.ค. (ไม่บังคับ)`
         : null,
   }
})

const selectedRound = computed(() => (roundSelect.value ? findRound(roundSelect.value) : null))
const effectiveRoundEnd = computed(() => {
   const opts = roundEndOptions(selectedRound.value)
   return opts.includes(roundEndSelect.value) ? roundEndSelect.value : opts[0] || null
})
const roundEndOptionsView = computed(() =>
   roundEndOptions(selectedRound.value).map(d => ({
      date: d,
      title: `ถึงวันที่ ${dayNum(d)} มกราคม`,
      desc: dayActivityText(d),
   }))
)

// เปลี่ยนรอบ → กลับไปเริ่มที่วันสุดท้ายที่บังคับ
watch(roundSelect, () => { roundEndSelect.value = null })

const selectionError = computed(() => {
   // ยังไม่เริ่มเลือก ไม่ต้องขึ้น error — ตัวเลือกบนจอบอกอยู่แล้วว่าต้องทำอะไร
   if (!effectiveMode.value) return null
   if (effectiveMode.value === MODE_OVERNIGHT) return null // เลือกจาก radio เลยผิดไม่ได้
   if (activitySelect.value.length === 0) return null
   return validateSelection({ mode: effectiveMode.value, activityIds: activitySelect.value })
})

const selection = computed(() => ({
   mode: effectiveMode.value,
   activityIds: activitySelect.value,
   roundId: roundSelect.value,
   roundEndDay: effectiveRoundEnd.value,
}))

const result = computed(() => {
   if (!origin.value || !vehicleTypeSelect.value || !effectiveMode.value) return null
   if (validateSelection(selection.value)) return null
   return calculateFare({
      origin: origin.value,
      vehicleType: vehicleTypeSelect.value,
      fuelPrice: fuelPrice.value,
      ...selection.value,
   })
})

// รวมบรรทัดย่อย (เช่น ข้อ 3 รายวัน) เป็นหัวข้อเดียวต่อเลขข้อ
const groups = computed(() => {
   if (!result.value) return []
   const map = new Map()
   result.value.lines.forEach(line => {
      if (!map.has(line.no)) map.set(line.no, { no: line.no, label: GROUP_LABELS[line.no], amount: 0, lines: [] })
      const g = map.get(line.no)
      g.lines.push(line)
      g.amount = g.amount === null || line.amount === null ? null : g.amount + line.amount
   })
   return [...map.values()].map(g => {
      let note = null
      if (g.amount === null) note = g.lines.find(l => l.amount === null).formula
      else if (g.amount === 0) note = g.lines[0].formula
      // โชว์วิธีคิดสั้น ๆ เฉพาะเมื่อมีการคูณ (เช่น "× 2 เที่ยว") — ถ้าเป็นแค่ "3,500 บาท" ซ้ำกับยอดอยู่แล้ว
      else if (SHORT_FORMULA_GROUPS.includes(g.no) && g.lines[0].formula.includes('×')) note = g.lines[0].formula
      return { ...g, note }
   })
})

const missingLabels = computed(() => groups.value.filter(g => g.amount === null).map(g => g.label).join(' และ'))

const modeSummary = computed(() => {
   const r = result.value
   if (!r) return ''
   if (effectiveMode.value === MODE_ROUND_TRIP) return `ไป-กลับ · ${r.activityCount} กิจกรรม`
   const first = dayNum(r.stayDays[0])
   const last = dayNum(r.stayDays[r.stayDays.length - 1])
   return `พักค้าง ${r.nights} คืน (${first}–${last} ม.ค.) · ${r.activityCount} กิจกรรม`
})

// มีตัวเลือกเดียวเลือกให้อัตโนมัติ ไม่งั้นล้างค่าเดิม
const autoPoint = () => (points.value.length === 1 ? points.value[0].key : null)
watch(provinceSelect, () => {
   amphurSelect.value = !pointFirst.value && amphurs.value.length === 1 ? amphurs.value[0] : null
   pointKeySelect.value = autoPoint()
})
watch(amphurSelect, () => {
   pointKeySelect.value = autoPoint()
})

watch(result, (r) => {
   if (r) viewedAt.value = new Date()
})

// ติดตามว่าผลลัพธ์อยู่ในจอหรือยัง เพื่อซ่อน/โชว์แถบยอดรวมด้านล่าง
let observer = null
watch(resultEl, (el, oldEl) => {
   if (!observer) return
   if (oldEl) observer.unobserve(oldEl)
   if (el) observer.observe(el)
   else resultInView.value = false
})

function scrollToResult() {
   resultEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function resetAll() {
   provinceSelect.value = null
   vehicleTypeSelect.value = null
   modeSelect.value = null
   activitySelect.value = []
   roundSelect.value = null
   nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}

let previousTitle = ''
onMounted(() => {
   previousTitle = document.title
   document.title = PAGE_TITLE
   if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => { resultInView.value = entry.isIntersecting }, { threshold: 0.15 })
      if (resultEl.value) observer.observe(resultEl.value)
   } else {
      resultInView.value = true // เบราว์เซอร์เก่า: ไม่โชว์แถบลอย
   }
   if (!diesel.currentDieselPrice) {
      diesel.fetchDieselPrices()
   }
})
onBeforeUnmount(() => {
   document.title = previousTitle
   observer?.disconnect()
})

const VEHICLE_LABELS = {
   'รถตู้': 'รถตู้',
   'รถบัสพัดลม': 'รถบัสพัดลม',
   'รถบัสแอร์1 ชั้น': 'รถบัสแอร์ 1 ชั้น',
   'รถบัสแอร์2 ชั้น': 'รถบัสแอร์ 2 ชั้น',
}
const vehicleLabel = (v) => VEHICLE_LABELS[v] || v

const money = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('th-TH'))

const formatFullDate = (isoDate) => new Intl.DateTimeFormat('th-TH', {
   weekday: 'long',
   day: 'numeric',
   month: 'long',
   year: 'numeric',
}).format(new Date(`${isoDate}T00:00:00`))

const formatDateTime = (date) => new Intl.DateTimeFormat('th-TH', {
   day: 'numeric',
   month: 'long',
   year: 'numeric',
   hour: '2-digit',
   minute: '2-digit',
}).format(date || new Date())
</script>

<style scoped>
/* ออกแบบสำหรับผู้ใช้วัย 50+ บนมือถือ: ตัวหนังสือใหญ่ คอนทราสต์สูง ปุ่มแตะง่าย (สูง ≥ 56px)
   ธีมฟ้า-ขาวไล่เฉด (ผู้ขอฟีเจอร์ขอ 2026-11-12) — สีเข้มสุดของทุก gradient ที่มีตัวหนังสือขาวทับต้องผ่าน 4.5:1 */
.dy {
   --ink: #102a43;
   --muted: #44546a;
   --surface: #ffffff;
   --line: #c9ddf2;
   --accent: #1565c0;
   --accent-dark: #0d47a1;
   --accent-ink: #ffffff;
   --accent-tint: #e3f2fd;
   --sky-top: #d6ebff;
   --sky-bottom: #ffffff;
   --good: #0d47a1;
   --warn-bg: #fff5dc;
   --warn-line: #e3be5c;
   --warn-ink: #6e4b00;
   --info-bg: #eef3f8;
   --info-line: #a9c0d8;
   --err-bg: #fdeceb;
   --err-line: #e2a19c;
   --err: #a3221b;

   min-height: 100vh;
   padding-bottom: 96px;
   background: linear-gradient(180deg, var(--sky-top) 0%, #eef6ff 35%, var(--sky-bottom) 100%);
   color: var(--ink);
   font-size: 18px;
   line-height: 1.6;
}

.dy-wrap {
   max-width: 640px;
   margin: 0 auto;
   padding: 0 16px;
}

/* หัวหน้า: แถบน้ำเงินไล่เฉด ตัวหนังสือขาว */
.dy-header {
   background: linear-gradient(135deg, var(--accent-dark) 0%, #1976d2 100%);
   color: #ffffff;
   padding: 22px 0 24px;
}

.dy-eyebrow {
   margin: 0;
   color: #e3f2fd;
   font-size: 16px;
   font-weight: 600;
}

.dy-title {
   margin: 2px 0 4px;
   font-size: 28px;
   font-weight: 700;
   line-height: 1.3;
}

.dy-lead {
   margin: 0;
   color: #ffffff;
   opacity: 0.95;
}

.dy-main {
   padding-top: 16px;
}

/* ขั้นตอน */
.dy-step {
   margin-top: 16px;
   padding: 18px 16px 20px;
   background: var(--surface);
   border: 1px solid var(--line);
   border-radius: 12px;
}

.dy-step.is-waiting .dy-step__title {
   color: var(--muted);
}

.dy-step__title {
   display: flex;
   align-items: center;
   gap: 12px;
   margin: 0 0 14px;
   font-size: 22px;
   font-weight: 700;
   line-height: 1.35;
}

.dy-step__no {
   flex: 0 0 auto;
   display: inline-flex;
   align-items: center;
   justify-content: center;
   width: 36px;
   height: 36px;
   border: 2px solid var(--accent);
   border-radius: 50%;
   color: var(--accent);
   font-size: 18px;
   font-weight: 700;
}

.dy-step.is-waiting .dy-step__no {
   border-color: var(--line);
   color: var(--muted);
}

.dy-step.is-done .dy-step__no {
   background: var(--accent);
   color: var(--accent-ink);
}

.dy-step__no .mdi {
   font-size: 22px;
   line-height: 1;
}

.dy-hint {
   margin: 0;
   color: var(--muted);
}

.dy-hint--plain {
   margin-bottom: 10px;
}

.dy-muted {
   color: var(--muted);
   font-weight: 400;
}

/* ช่องเลือก (select ของระบบ — มือถือจะเปิดตัวเลือกแบบเต็มจอที่ผู้ใช้คุ้นเคย) */
.dy-field {
   display: block;
   margin-top: 14px;
}

.dy-field:first-of-type {
   margin-top: 0;
}

.dy-field__label {
   display: block;
   margin-bottom: 6px;
   font-weight: 600;
}

.dy-select {
   position: relative;
   display: block;
}

.dy-select select {
   width: 100%;
   min-height: 56px;
   padding: 12px 48px 12px 14px;
   border: 2px solid var(--line);
   border-radius: 8px;
   background: var(--surface);
   color: var(--ink);
   font-size: 19px;
   appearance: none;
   cursor: pointer;
}

.dy-select select:focus-visible {
   outline: 3px solid var(--accent);
   outline-offset: 2px;
   border-color: var(--accent);
}

.dy-select .mdi {
   position: absolute;
   top: 50%;
   right: 12px;
   transform: translateY(-50%);
   font-size: 28px;
   color: var(--muted);
   pointer-events: none;
}

/* ตัวเลือกแบบการ์ด (radio) */
.dy-options {
   display: grid;
   gap: 10px;
}

.dy-options--grid {
   grid-template-columns: 1fr 1fr;
}

.dy-option {
   display: flex;
   flex-direction: column;
   justify-content: center;
   min-height: 64px;
   padding: 12px 14px;
   border: 2px solid var(--line);
   border-radius: 8px;
   background: var(--surface);
   cursor: pointer;
}

.dy-option.is-selected {
   border-color: var(--accent);
   background: var(--accent-tint);
   box-shadow: inset 0 0 0 1px var(--accent);
}

.dy-option:focus-within {
   outline: 3px solid var(--accent);
   outline-offset: 2px;
}

.dy-option__title {
   font-size: 19px;
   font-weight: 700;
   line-height: 1.4;
}

.dy-option__title .mdi {
   margin-right: 4px;
   color: var(--accent);
}

.dy-option__desc {
   color: var(--muted);
   font-size: 16px;
   line-height: 1.5;
}

/* รายการวัน (checkbox) */
.dy-check {
   display: flex;
   align-items: center;
   gap: 14px;
   min-height: 60px;
   padding: 10px 14px;
   border: 2px solid var(--line);
   border-radius: 8px;
   background: var(--surface);
   cursor: pointer;
}

.dy-check + .dy-check {
   margin-top: 8px;
}

.dy-check.is-selected {
   border-color: var(--accent);
   background: var(--accent-tint);
}

.dy-day + .dy-day {
   margin-top: 16px;
}

.dy-day__date {
   margin: 0 0 6px;
   font-weight: 700;
}

.dy-day__note {
   margin-left: 6px;
   padding: 0 8px;
   border: 1px solid var(--line);
   border-radius: 4px;
   color: var(--muted);
   font-size: 15px;
   font-weight: 600;
}

.dy-check__desc {
   color: var(--muted);
   font-size: 16px;
}

.dy-subtitle {
   margin: 18px 0 8px;
   font-weight: 700;
}

.dy-round__line strong {
   color: var(--ink);
   font-weight: 600;
}

.dy-round__optional {
   margin-top: 2px;
   font-style: italic;
}

.dy-check.is-disabled {
   opacity: 0.45;
   cursor: not-allowed;
}

.dy-check:focus-within {
   outline: 3px solid var(--accent);
   outline-offset: 2px;
}

.dy-check__box {
   flex: 0 0 auto;
   display: inline-flex;
   align-items: center;
   justify-content: center;
   width: 30px;
   height: 30px;
   border: 2px solid var(--muted);
   border-radius: 6px;
   background: var(--surface);
   color: transparent;
}

.dy-check.is-selected .dy-check__box {
   border-color: var(--accent);
   background: var(--accent);
   color: var(--accent-ink);
}

.dy-check__box .mdi {
   font-size: 22px;
   line-height: 1;
}

.dy-check__text {
   display: flex;
   flex-direction: column;
}

.dy-check__title {
   font-weight: 600;
}

/* กล่องข้อความ */
.dy-note {
   display: flex;
   align-items: flex-start;
   gap: 10px;
   margin: 12px 0 0;
   padding: 12px 14px;
   border: 1px solid;
   border-radius: 8px;
   font-size: 17px;
}

.dy-note .mdi {
   font-size: 24px;
   line-height: 1.2;
}

.dy-note--warn {
   background: var(--warn-bg);
   border-color: var(--warn-line);
   color: var(--warn-ink);
}

.dy-note--info {
   background: var(--info-bg);
   border-color: var(--info-line);
   color: var(--ink);
}

.dy-note--info .mdi {
   color: var(--accent);
}

.dy-note--error {
   background: var(--err-bg);
   border-color: var(--err-line);
   color: var(--err);
}

.dy-main > .dy-note:first-child {
   margin-top: 0;
}

/* ผลลัพธ์ */
.dy-result {
   margin-top: 24px;
   padding: 20px 16px;
   background: linear-gradient(180deg, var(--accent-tint) 0%, var(--surface) 160px);
   border: 2px solid var(--accent);
   border-radius: 12px;
   scroll-margin-top: 12px;
}

.dy-result > .dy-note:first-child {
   margin: 0 0 14px;
}

.dy-result__heading {
   margin: 0;
   font-size: 20px;
   font-weight: 600;
   color: var(--muted);
}

.dy-total {
   margin: 0;
   color: var(--good);
   line-height: 1.2;
}

.dy-total__num {
   font-size: 48px;
   font-weight: 700;
   font-variant-numeric: tabular-nums;
}

.dy-total__unit {
   margin-left: 6px;
   font-size: 24px;
   font-weight: 600;
}

.dy-incomplete {
   margin: 6px 0 0;
   color: var(--err);
   font-weight: 600;
}

.dy-summary {
   margin: 8px 0 0;
   color: var(--muted);
}

.dy-breakdown {
   width: 100%;
   margin-top: 16px;
   border-collapse: collapse;
}

.dy-breakdown th,
.dy-breakdown td {
   padding: 12px 0;
   border-top: 1px solid var(--line);
   vertical-align: top;
}

.dy-breakdown th {
   text-align: left;
   font-weight: 600;
}

.dy-breakdown td {
   padding-left: 12px;
   text-align: right;
   white-space: nowrap;
   font-weight: 700;
   font-variant-numeric: tabular-nums;
}

.dy-breakdown td.is-missing {
   color: var(--err);
   font-weight: 600;
}

.dy-breakdown__note {
   display: block;
   color: var(--muted);
   font-size: 16px;
   font-weight: 400;
}

.dy-breakdown tfoot th,
.dy-breakdown tfoot td {
   border-top: 2px solid var(--ink);
   font-size: 20px;
   font-weight: 700;
}

.dy-details {
   margin-top: 16px;
   border: 1px solid var(--line);
   border-radius: 8px;
}

.dy-details summary {
   display: flex;
   align-items: center;
   justify-content: space-between;
   min-height: 52px;
   padding: 0 14px;
   color: var(--accent);
   font-weight: 600;
   list-style: none;
   cursor: pointer;
}

.dy-details summary::-webkit-details-marker {
   display: none;
}

.dy-details summary .mdi {
   font-size: 26px;
   transition: transform 0.15s;
}

.dy-details[open] summary .mdi {
   transform: rotate(180deg);
}

.dy-details summary:focus-visible {
   outline: 3px solid var(--accent);
   outline-offset: 2px;
}

.dy-details__list {
   margin: 0;
   padding: 0 14px 4px 34px;
}

.dy-details__list li {
   padding: 8px 0;
   border-top: 1px solid var(--line);
}

.dy-details__label,
.dy-details__formula,
.dy-details__amount {
   display: block;
}

.dy-details__formula {
   color: var(--muted);
   font-size: 16px;
}

.dy-details__amount {
   font-weight: 700;
}

.dy-details__foot {
   margin: 0;
   padding: 10px 14px 14px;
   color: var(--muted);
   font-size: 16px;
}

.dy-source {
   margin: 16px 0 0;
   color: var(--muted);
   font-size: 16px;
}

.dy-source a {
   color: var(--accent);
   font-weight: 600;
}

/* ปุ่ม */
.dy-btn {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   gap: 6px;
   min-height: 52px;
   padding: 10px 20px;
   border: 2px solid var(--accent);
   border-radius: 8px;
   font-size: 18px;
   font-weight: 700;
   cursor: pointer;
}

.dy-btn:focus-visible {
   outline: 3px solid var(--accent);
   outline-offset: 2px;
}

.dy-btn--primary {
   border-color: var(--accent-dark);
   background: linear-gradient(180deg, #1976d2 0%, var(--accent-dark) 100%);
   color: var(--accent-ink);
}

.dy-btn--ghost {
   background: var(--surface);
   color: var(--accent);
}

.dy-btn--small {
   min-height: 40px;
   margin-left: 8px;
   padding: 4px 14px;
   border-color: var(--err);
   background: var(--surface);
   color: var(--err);
   font-size: 16px;
}

.dy-btn--block {
   width: 100%;
   margin-top: 18px;
}

/* แถบยอดรวมลอยด้านล่าง */
.dy-sticky {
   position: fixed;
   left: 0;
   right: 0;
   bottom: 0;
   z-index: 1010;
   padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
   background: linear-gradient(180deg, var(--accent-tint) 0%, var(--surface) 100%);
   border-top: 2px solid var(--accent);
}

.dy-sticky__inner {
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 12px;
}

.dy-sticky .dy-btn {
   flex-shrink: 0;
   white-space: nowrap;
}

.dy-sticky__text strong {
   color: var(--good);
   font-size: 24px;
}

/* ซ่อนจากสายตาแต่ยังโฟกัสด้วยคีย์บอร์ด/โปรแกรมอ่านจอได้ */
.dy-sr {
   position: absolute;
   width: 1px;
   height: 1px;
   margin: -1px;
   overflow: hidden;
   clip: rect(0 0 0 0);
   white-space: nowrap;
   border: 0;
}

@media (max-width: 380px) {
   .dy-options--grid {
      grid-template-columns: 1fr;
   }

   .dy-total__num {
      font-size: 42px;
   }
}
</style>
