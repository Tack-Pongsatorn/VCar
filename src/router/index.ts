import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import UploadProvince from "../views/UploadProvince.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
    
      component: HomeView,
    },{
      path : '/upload',
      component : UploadProvince
    }
   
  ],
});

export default router;
