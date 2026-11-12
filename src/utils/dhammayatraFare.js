// ตัวคำนวณค่ารถงานธรรมยาตรา — pure functions ไม่แตะ Vue/store ทดสอบด้วย node ได้ตรง ๆ
// (import แบบ relative + นามสกุล .js เพื่อให้ node รันได้โดยไม่ต้องผ่าน Vite)
//
// ไป-กลับ : ผู้ใช้ติ๊กกิจกรรมจาก BOOKABLE_ACTIVITIES ได้วันเดียว
// พักค้าง  : ผู้ใช้เลือกรอบจาก OVERNIGHT_ROUNDS (+ อยู่ต่อถึงวันไหน) → ถือว่าร่วมทุกกิจกรรมจัดรถในวันที่พัก
//
// องค์ประกอบค่ารถ (เลขข้อตามเอกสาร):
//   1 ราคากลาง                 ต่อเที่ยว จุดออกรถ ↔ วัดพธก.
//   2 ค่าน้ำมันที่เพิ่มขึ้น          ต่อเที่ยว จากระยะทางมาวัดพธก.
//   3 ค่าวิ่งรถออกนอกพื้นที่        ต่อวัน (ไป-กลับ) จากสถานที่ที่ไกลที่สุดของวันนั้นเทียบกับวัด
//                               — ไม่คิดใน NO_OUT_OF_AREA_PROVINCES, กิจกรรมในวัด = 0
//   4 ค่าพักค้าง                 ต่อคืน (พักค้าง) จำนวนคืน = จำนวนวันในรอบที่พัก − 1 (วันติดกันตามปฏิทิน)
//   5 ค่าวิ่ง วัดพธก. → ที่จัดงาน    ต่อวัน (พักค้าง) เฉพาะวันที่มีกิจกรรมนอกวัด
//   6 ร่วม 2 กิจกรรมในวันเดียว      ต่อวันที่มีตั้งแต่ 2 กิจกรรม (ไป-กลับ: ที่ติ๊ก / พักค้าง: ในตาราง)
//
// ไป-กลับ : เลือกได้ ROUND_TRIP_MAX_DAYS (1) วัน = 1 เที่ยว → 1 + 2 + 3 + 6
// พักค้าง  : มาเที่ยวเดียวแล้วพักที่วัดพธก. → 1 + 2 + 4 × คืน + 5 × วันที่ออกนอกวัด + 6

import {
   FUEL_RATES,
   calculateExtraFuelCost,
   calculateFullFuelCost,
} from './fuel.js'
import {
   BOOKABLE_ACTIVITIES,
   FLAT_RATES,
   FUEL_BASE_PRICE,
   NO_OUT_OF_AREA_PROVINCES,
   OUT_OF_AREA_FUEL_PRICE_MODE,
   OVERNIGHT_ROUNDS,
   ROUND_TRIP_MAX_DAYS,
   STANDARD_PRICE_COLUMN,
   STANDARD_PRICE_LIMIT,
   VEHICLE_CLASS,
   VENUES,
   VENUE_AT_WAT,
} from '../config/dhammayatra.js'

export const MODE_ROUND_TRIP = 'roundtrip'
export const MODE_OVERNIGHT = 'overnight'

export const VENUE_KEYS = Object.keys(VENUES)

export function vehicleClassOf(vehicleType) {
   const cls = VEHICLE_CLASS[vehicleType]
   if (!cls) {
      throw new Error(`ประเภทรถไม่ถูกต้อง: ${vehicleType}`)
   }
   return cls
}

/**
 * รวมข้อมูล 2 ไฟล์เป็นรายการจุดออกรถ — 1 แถวต่อ 1 จุดออกรถในไฟล์ราคากลาง
 * ระยะทางมาวัด: ใช้ของไฟล์ราคากลางก่อน (ละเอียดถึงระดับจุด และเป็นฐานของราคากลาง) ไม่มีค่อยใช้ไฟล์ระยะทาง
 * ระยะทางไปพื้นที่จัดงาน: มีแค่ในไฟล์ระยะทาง (ระดับอำเภอ) — อำเภอที่ไม่มีในไฟล์นั้นจะเป็น null
 */
export function buildOrigins(priceRows, distanceRows) {
   const byAmphur = new Map(distanceRows.map(d => [`${d.province}|${d.amphur}`, d]))
   return priceRows.map(p => {
      const d = byAmphur.get(`${p.province}|${p.amphur}`)
      const origin = {
         province: p.province,
         amphur: p.amphur,
         point: p.point,
         prices: Object.fromEntries(Object.entries(STANDARD_PRICE_COLUMN).map(([type, col]) => [type, p[col] ?? null])),
         toWat: p.toWat ?? d?.toWat ?? null,
      }
      VENUE_KEYS.forEach(v => { origin[v] = d?.[v] ?? null })
      return origin
   })
}

// ราคากลางของจุดออกรถตามประเภทรถ — null = ไม่มีข้อมูล
export function findStandardPrice(origin, vehicleType) {
   vehicleClassOf(vehicleType) // ตรวจว่าประเภทรถถูกต้อง
   const price = origin?.prices?.[vehicleType]
   return Number.isFinite(price) ? price : null
}

// 'unknown' = ไม่มีราคากลาง (ให้เลือกเองได้), 'choose' = ไม่เกินเกณฑ์, 'forced' = เกินเกณฑ์ บังคับพักค้าง
export function eligibilityOf(standardPrice, vehicleType) {
   if (standardPrice === null) return 'unknown'
   return standardPrice > STANDARD_PRICE_LIMIT[vehicleClassOf(vehicleType)] ? 'forced' : 'choose'
}

export function formatThaiDate(isoDate) {
   return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
      .format(new Date(`${isoDate}T00:00:00`))
}

// จัดกิจกรรมที่เลือกเป็นรายวัน [{ date, activities }] เรียงตามวันที่
// (ตัด id ที่ซ้ำ / ไม่มีในตาราง / เป็นกิจกรรมที่ไม่จัดรถ ทิ้ง)
export function groupByDay(activityIds) {
   const days = new Map()
   BOOKABLE_ACTIVITIES.filter(a => activityIds.includes(a.id)).forEach(a => {
      if (!days.has(a.date)) days.set(a.date, [])
      days.get(a.date).push(a)
   })
   return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, activities]) => ({ date, activities }))
}

// ---------- รอบพักค้าง ----------

export function findRound(roundId) {
   return OVERNIGHT_ROUNDS.find(r => r.id === roundId) || null
}

// ตัวเลือก "อยู่ถึงวันไหน" ของรอบ = วันสุดท้ายที่บังคับ + วันที่อยู่ต่อได้แต่ละวัน
export function roundEndOptions(round) {
   return round ? [round.days[round.days.length - 1], ...round.optionalDays] : []
}

// วันที่พักทั้งหมด (ตามปฏิทิน ต่อเนื่อง) ตั้งแต่วันแรกของรอบถึง endDay — endDay ว่าง = วันสุดท้ายที่บังคับ
export function roundStayDays(round, endDay = null) {
   if (!round) return []
   const all = [...round.days, ...round.optionalDays]
   const end = endDay && roundEndOptions(round).includes(endDay) ? endDay : round.days[round.days.length - 1]
   return all.slice(0, all.indexOf(end) + 1)
}

// id กิจกรรมจัดรถทั้งหมดในวันที่พัก
export function roundActivityIds(round, endDay = null) {
   const stay = roundStayDays(round, endDay)
   return BOOKABLE_ACTIVITIES.filter(a => stay.includes(a.date)).map(a => a.id)
}

// คืนข้อความ error ภาษาไทย หรือ null ถ้าเลือกครบ
//   ไป-กลับ ใช้ activityIds · พักค้าง ใช้ roundId (+ roundEndDay)
export function validateSelection({ mode, activityIds, roundId, roundEndDay = null }) {
   if (!mode) return 'กรุณาเลือกแบบการร่วมงาน'
   if (mode === MODE_OVERNIGHT) {
      const round = findRound(roundId)
      if (!round) return 'กรุณาเลือกรอบพักค้าง'
      if (roundEndDay && !roundEndOptions(round).includes(roundEndDay)) return 'วันที่อยู่ถึงไม่อยู่ในรอบนี้'
      return null
   }
   const known = (activityIds || []).filter(id => BOOKABLE_ACTIVITIES.some(a => a.id === id))
   if (known.length === 0) return 'กรุณาเลือกกิจกรรมอย่างน้อย 1 กิจกรรม'
   const dayCount = groupByDay(known).length
   if (dayCount > ROUND_TRIP_MAX_DAYS) {
      return `ไป-กลับเลือกได้ ${ROUND_TRIP_MAX_DAYS} วัน (ตอนนี้เลือกไว้ ${dayCount} วัน) — แตะกิจกรรมของวันที่ต้องการ`
   }
   return null
}

function fmt(n) {
   return Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

const isAtWat = a => a.venue === VENUE_AT_WAT

// ข้อ 3 ของ 1 วัน: ค่าน้ำมันของระยะที่วิ่งเกินวัดพธก. ไปยังสถานที่ที่ไกลที่สุดของวันนั้น
function outOfAreaLine(day, origin, vehicleType, fuelPrice) {
   const venueNames = [...new Set(day.activities.map(a => VENUES[a.venue]))].join(' + ')
   const label = `ค่าวิ่งรถออกนอกพื้นที่ — ${formatThaiDate(day.date)} (${venueNames})`
   const outside = [...new Set(day.activities.filter(a => !isAtWat(a)).map(a => a.venue))]
   if (outside.length === 0) {
      return { no: 3, label, amount: 0, formula: 'จัดที่วัดพระธรรมกาย ไม่มีระยะทางเพิ่ม' }
   }
   const venueKms = outside.map(v => origin[v])
   if (origin.toWat === null || venueKms.some(km => km === null || km === undefined)) {
      const missing = outside.filter(v => origin[v] === null || origin[v] === undefined).map(v => VENUES[v])
      return {
         no: 3,
         label,
         amount: null,
         formula: origin.toWat === null
            ? 'ไม่มีข้อมูลระยะทางมาวัดพธก. จากจุดออกรถนี้'
            : `ไม่มีข้อมูลระยะทางไป${missing.join(', ')}จากจุดออกรถนี้`,
      }
   }
   if (fuelPrice === null) {
      return { no: 3, label, amount: null, formula: 'ยังไม่ได้ราคาน้ำมัน' }
   }
   const venueKm = Math.max(...venueKms)
   const extraKm = venueKm - origin.toWat
   if (extraKm <= 0) {
      return { no: 3, label, amount: 0, formula: `ที่จัดงาน (${fmt(venueKm)} กม.) ไม่ไกลกว่าวัดพธก. (${fmt(origin.toWat)} กม.)` }
   }
   const kmL = FUEL_RATES[vehicleType]
   const full = OUT_OF_AREA_FUEL_PRICE_MODE === 'full'
   const amount = full
      ? calculateFullFuelCost(vehicleType, extraKm, fuelPrice)
      : calculateExtraFuelCost(vehicleType, extraKm, fuelPrice, FUEL_BASE_PRICE)
   const priceText = full ? `${fmt(fuelPrice)}` : `(${fmt(fuelPrice)} − ${FUEL_BASE_PRICE})`
   return {
      no: 3,
      label,
      amount,
      formula: `(${fmt(venueKm)} − ${fmt(origin.toWat)}) กม. × 2 ÷ ${kmL} กม./ลิตร × ${priceText} บาท`,
   }
}

/**
 * @param origin      จุดออกรถ 1 รายการจาก buildOrigins()
 * @param vehicleType key ใน FUEL_RATES
 * @param fuelPrice   ราคาน้ำมันต่อลิตร หรือ null ถ้ายังดึงไม่ได้
 * @param mode        MODE_ROUND_TRIP | MODE_OVERNIGHT
 * @param activityIds ไป-กลับ: id ของกิจกรรมที่ติ๊ก
 * @param roundId     พักค้าง: id ใน OVERNIGHT_ROUNDS
 * @param roundEndDay พักค้าง: อยู่ถึงวันไหน (null = วันสุดท้ายที่บังคับ)
 */
export function calculateFare({ origin, vehicleType, fuelPrice, mode, activityIds = [], roundId = null, roundEndDay = null }) {
   const cls = vehicleClassOf(vehicleType)
   const round = mode === MODE_OVERNIGHT ? findRound(roundId) : null
   const stayDays = round ? roundStayDays(round, roundEndDay) : []
   const days = groupByDay(round ? roundActivityIds(round, roundEndDay) : activityIds)
   const trips = mode === MODE_ROUND_TRIP ? days.length : 1
   const standardPrice = findStandardPrice(origin, vehicleType)
   const lines = []
   const perTrip = trips > 1 ? ` × ${trips} เที่ยว` : ''

   // ข้อ 1 ราคากลาง
   lines.push({
      no: 1,
      label: 'ราคากลาง',
      amount: standardPrice === null ? null : standardPrice * trips,
      formula: standardPrice === null ? 'ยังไม่มีข้อมูลราคากลางของจุดออกรถนี้' : `${fmt(standardPrice)} บาท${perTrip}`,
   })

   // ข้อ 2 ค่าน้ำมันที่เพิ่มขึ้น
   if (origin.toWat === null) {
      lines.push({ no: 2, label: 'ค่าน้ำมันที่เพิ่มขึ้น', amount: null, formula: 'ไม่มีข้อมูลระยะทางมาวัดพธก.' })
   } else if (fuelPrice === null) {
      lines.push({ no: 2, label: 'ค่าน้ำมันที่เพิ่มขึ้น', amount: null, formula: 'ยังไม่ได้ราคาน้ำมัน' })
   } else {
      const oneTrip = calculateExtraFuelCost(vehicleType, origin.toWat, fuelPrice, FUEL_BASE_PRICE)
      lines.push({
         no: 2,
         label: 'ค่าน้ำมันที่เพิ่มขึ้น',
         amount: oneTrip * trips,
         formula: fuelPrice <= FUEL_BASE_PRICE
            ? `ราคาน้ำมัน ${fmt(fuelPrice)} ไม่เกินราคาฐาน ${FUEL_BASE_PRICE} บาท`
            : `${fmt(origin.toWat)} กม. × 2 ÷ ${FUEL_RATES[vehicleType]} กม./ลิตร × (${fmt(fuelPrice)} − ${FUEL_BASE_PRICE}) บาท`
               + (trips > 1 ? ` = ${fmt(oneTrip)}${perTrip}` : ''),
      })
   }

   let nights = 0
   if (mode === MODE_ROUND_TRIP) {
      if (NO_OUT_OF_AREA_PROVINCES.includes(origin.province)) {
         // กทม./ปริมณฑล ไม่คิดข้อ 3 — แสดงบรรทัดเดียวพร้อมเหตุผล ให้ผู้ใช้รู้ว่าไม่ได้ตกหล่น
         lines.push({
            no: 3,
            label: 'ค่าวิ่งรถออกนอกพื้นที่',
            amount: 0,
            formula: `ไม่คิดสำหรับจุดออกรถใน ${NO_OUT_OF_AREA_PROVINCES.join(' ')}`,
         })
      } else {
         days.forEach(day => lines.push(outOfAreaLine(day, origin, vehicleType, fuelPrice)))
      }
   } else {
      // ข้อ 4 ค่าพักค้าง: จำนวนคืน = จำนวนวันในรอบที่พัก − 1 (ผู้ขอยืนยัน "วัน − 1" 2026-11-12; วันในรอบติดกันตามปฏิทิน
      // จึงเท่ากับคืนจริง — นับรวมวันที่ไม่มีกิจกรรม เช่น 1 ม.ค. วันเดินทางมาถึง และ 23 ม.ค. วันว่าง)
      nights = Math.max(stayDays.length - 1, 0)
      if (nights > 0) {
         lines.push({
            no: 4,
            label: 'ค่าพักค้าง',
            amount: FLAT_RATES.overnight[cls] * nights,
            formula: `${fmt(FLAT_RATES.overnight[cls])} บาท × ${nights} คืน`,
         })
      }
      // ข้อ 5 ค่าวิ่งจากวัดพธก. ไปที่จัดงาน — เฉพาะวันที่มีกิจกรรมนอกวัด
      const outDays = days.filter(d => d.activities.some(a => !isAtWat(a))).length
      if (outDays > 0) {
         lines.push({
            no: 5,
            label: 'ค่าวิ่งรถ วัดพธก. → ที่จัดงาน',
            amount: FLAT_RATES.watToVenue[cls] * outDays,
            formula: `${fmt(FLAT_RATES.watToVenue[cls])} บาท × ${outDays} วัน`,
         })
      }
   }

   // ข้อ 6 วันที่มีตั้งแต่ 2 กิจกรรม (ไป-กลับ: ที่ติ๊ก / พักค้าง: กิจกรรมจัดรถทั้งหมดของวันนั้น)
   const multiDays = days.filter(d => d.activities.length >= 2)
   if (multiDays.length) {
      lines.push({
         no: 6,
         label: 'ค่าร่วมงาน 2 กิจกรรมในวันเดียวกัน',
         amount: FLAT_RATES.twoActivitiesSameDay[cls] * multiDays.length,
         formula: `${fmt(FLAT_RATES.twoActivitiesSameDay[cls])} บาท × ${multiDays.length} วัน (${multiDays.map(d => formatThaiDate(d.date)).join(', ')})`,
      })
   }

   const missing = lines.filter(l => l.amount === null)
   return {
      lines,
      total: lines.reduce((sum, l) => sum + (l.amount ?? 0), 0),
      complete: missing.length === 0,
      missing,
      standardPrice,
      eligibility: eligibilityOf(standardPrice, vehicleType),
      trips,
      nights,
      days,
      stayDays,
      activityCount: days.reduce((n, d) => n + d.activities.length, 0),
   }
}
