import { createRouter, createWebHistory } from "vue-router";
import DieselPriceView from "../views/DieselPriceView.vue";
import HomeView from "../views/HomeView.vue";
import UploadProvince from "../views/UploadProvince.vue";

const router = createRouter({
   history: createWebHistory(import.meta.env.BASE_URL),
   routes: [
      {
         path: "/",
         name: "home",
         component: DieselPriceView,
         // component: HomeView,
      }, {
         path: '/upload',
         name: 'upload',
         component: UploadProvince
      },
      {
         path: '/diesel-price',
         name: 'diesel-price',
         component: DieselPriceView
      }

   ],
});

export default router;
