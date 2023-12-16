<template>
  <v-parallax class="home"
    src="https://www.dmc.tv/images/rw25_1.2.jpg">
    <v-container fluid fill-height>
      <v-row justify="center">
        <v-col cols="12">
          <v-row class="justify-center">
            <v-col cols="11" lg="3" md="3" sm="5">
              <v-card color="blue" variant="tonal" class="pa-4">
                <v-img :src="'https://www.dmc.tv/dhammayatra/images/logo2.png'"></v-img>
              </v-card>
            </v-col>
          </v-row>
          <br />
          <v-row class="justify-center">
            <v-col cols="11" lg="4" md="4" sm="6">
              <v-form ref="form" v-model="valid" lazy-validation>
                <v-card class="pa-5" color="white" variant="flat" elevation="8">
                  <h2 class="text-center" variant="tonal">
                    ค่าวิ่งรถออกนอกพื้นที่
                  </h2>
                  <p class="text-center">
                    (กรณีเดินทางจากจุดออกรถในจังหวัดต่าง ๆ <br />
                    มาร่วมกิจกรรมธรรมยาตรา)
                  </p>
                  <br />
                  <v-select v-model="provinceSelect" :items="province" variant="underlined" item-title="name_th"
                    item-value="name_th" clearable label="จังหวัดต้นทาง" prepend-inner-icon="mdi-map-search-outline"
                    :rules="[(v) => !!v || 'กรุณาเลือกจังหวัด']"></v-select>

                  <!-- <v-select
                    v-if="district.length > 0"
                    v-model="selectDistrict"
                    :items="district"
                    label="อำเภอ"
                    item-title="province"
                    item-value="province"
                    clearable
                    prepend-inner-icon="mdi-map-search"
                    required
                    variant="underlined"
                  ></v-select> -->

                  <v-select v-model="select" :items="items" :rules="[(v) => !!v || 'กรุณาเลือกประเภทรถโดยสาร']"
                    label="ประเภทรถโดยสาร" prepend-inner-icon="mdi-bus" required variant="underlined"></v-select>

                  <v-row>
                    <v-col>
                      <v-btn block class="mb-2" color="blue" size="large" variant="tonal" @click="submit">
                        ค้นหา
                      </v-btn>
                    </v-col>
                  </v-row>
                </v-card>
              </v-form>
            </v-col>
          </v-row>
        </v-col>
        <v-col v-if="showDisplayfuelRate" cols="11" lg="4" md="4" sm="6" :key="keyComponent">
          <v-card>
            <v-card-item class="pa-5">
              <p class="text-center pa-5 textNumber">{{ rateFuelValue }} บาท</p>
              <p class="text-center textType">
                จังหวัด {{ provinceSelect }} ประเภท {{ select }}
              </p>
              <!-- {{rateValueFromStore.district}}
              <v-list-item
                v-for="item in rateValueFromStore.district"
                :key="item.province"
                :title="item"
                subtitle="..."
              ></v-list-item> -->
            </v-card-item>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-parallax>
</template>

<script>
import provinceData from "../stores/province";
import db from "../../firebase-config";
export default {
  data: () => ({
    valid: true,
    provinceSelect: null,
    nameRules: [
      (v) => !!v || "Name is required",
      (v) => (v && v.length <= 10) || "Name must be less than 10 characters",
    ],
    province: [],
    select: null,
    items: ["รถตู้", "รถบัส"],
    provinceWithout: [
      "กรุงเทพมหานคร",
      "นนทบุรี",
      "ปทุมธานี",
      "สมุทรปราการ",
      "กาญจนบุรี",
    ],
    selectDistrict: false,
    district: [],
    search: null,
    rateValueFromStore: null,
    rateValueFromStoreDefault: null,
    showDisplayfuelRate: false,
    rateFuelValue: null,
    rateFuleDistrict: null,
    keyComponent: 0,
  }),
  created() {
    this.fetchProvince();
  },

  methods: {
    fetchProvince() {
      this.province = provinceData.sort((a, b) =>
        a.name_th.localeCompare(b.name_th, "th")
      );
      // .filter((name) => !this.provinceWithout.includes(name.name_th));
    },
    async getFuelRate() {
      await db
        .collection("rateCar4")
        .doc(this.provinceSelect)
        .get()
        .then((doc) => {
          if (doc.exists) {
            this.rateValueFromStore = doc.data();
          } else {
            this.rateValueFromStore = {
              bus: "xxxx",
              van: "xxxx",
              province: "xxxx",
            };
            console.log("No such document!");
          }
        })
        .catch((error) => {
          console.log("Error getting document:", error);
        });
    },
    async submit() {
      const { valid } = await this.$refs.form.validate();
      if (!valid) return;
      this.showDisplayfuelRate = true;

      if (this.select == "รถบัส") {
        this.rateFuelValue = this.rateValueFromStore.bus;
      } else {
        this.rateFuelValue = this.rateValueFromStore.van;
      }
    },

    reset() {
      this.$refs.form.reset();
      this.showDisplayfuelRate = null;
    },
  },
  watch: {
    provinceSelect(value) {
      if (value) this.getFuelRate();
      this.showDisplayfuelRate = false;
      this.rateFuelValue = "";
      this.keyComponent++;
    },
    select() {
      this.showDisplayfuelRate = false;
      this.rateFuelValue = "";
      this.keyComponent++;
    },
  },
};
</script>
<style>
.home {
  width: 100%;
  height: 100%;
  left: 0;
  -webkit-background-size: cover;
  -moz-background-size: cover;
  -o-background-size: cover;
  background-size: cover;
}

.textNumber {
  font-size: 40px;
}

.textType {
  font-size: 20px;
  color: grey;
}
</style>
