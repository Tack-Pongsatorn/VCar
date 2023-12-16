<template>
    <div>
        <v-btn block color="primary" dark @click="upload">upload</v-btn>
    </div>
</template>

<script>
import provinces from "@/assets/province_raw"
import db from "../../firebase-config"
export default {
    name: 'FuelRateCarUploadProvince',

    data() {
        return {

        };
    },

    mounted() {

    },

    methods: {
        async upload() {
            // insert data to doc
            const myCollection = await db.collection('rateCar4');
            provinces.forEach(data => {
                const docRef = myCollection.doc(data.province);
                docRef.set(data)
                    .then(() => {
                        console.log('Document successfully written with ID: ', data.province);
                    })
                    .catch(error => {
                        console.error('Error writing document: ', error);
                    });
            });
            console.log('province :>> ', province);
        }

    },
};
</script>

<style lang="scss" scoped></style>