// สูตรและค่าคงที่เรื่องน้ำมัน — ใช้ร่วมกันทุกหน้า (DieselPriceView, DhammayatraView)
// แก้ที่นี่ที่เดียวแล้วทุกหน้าเปลี่ยนตามกัน

// ราคาฐาน (บาท/ลิตร) ส่วนที่ราคาน้ำมันเกินจากนี้คือส่วนที่เบิกเพิ่มได้
export const BASE_PRICE = 33

// อัตราสิ้นเปลือง (กม./ลิตร) — ลำดับ key คือลำดับที่แสดงใน dropdown ประเภทรถ
export const FUEL_RATES = {
   'รถตู้': 10,
   'รถบัสพัดลม': 5.5,
   'รถบัสแอร์1 ชั้น': 4.2,
   'รถบัสแอร์2 ชั้น': 3.2,
}

export const VEHICLE_TYPES = Object.keys(FUEL_RATES)

// จำนวนลิตรที่ใช้ — oneWayKm คือระยะทางเที่ยวเดียว (ข้อมูลระยะทางทุกไฟล์เป็นเที่ยวเดียว) จึงคูณ 2 เป็นไป-กลับ
export function litersForRoundTrip(vehicleType, oneWayKm) {
   const kmPerLiter = FUEL_RATES[vehicleType]
   if (kmPerLiter === undefined) {
      throw new Error(`ประเภทรถไม่ถูกต้อง: ${vehicleType}`)
   }
   return (oneWayKm * 2) / kmPerLiter
}

// ค่าน้ำมันส่วนที่ราคาน้ำมันสูงกว่าราคาฐาน สำหรับระยะไป-กลับ (ปัดขึ้นเป็นบาทเต็ม)
export function calculateExtraFuelCost(vehicleType, oneWayKm, fuelPricePerLiter, basePrice = BASE_PRICE) {
   const liters = litersForRoundTrip(vehicleType, oneWayKm)
   if (fuelPricePerLiter <= basePrice) {
      return 0
   }
   return Math.ceil(liters * (fuelPricePerLiter - basePrice))
}

// ค่าน้ำมันเต็มราคา สำหรับระยะไป-กลับ (ปัดขึ้นเป็นบาทเต็ม)
export function calculateFullFuelCost(vehicleType, oneWayKm, fuelPricePerLiter) {
   return Math.ceil(litersForRoundTrip(vehicleType, oneWayKm) * fuelPricePerLiter)
}
