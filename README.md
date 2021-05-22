# PharmaDashBackEnd

This repository contains the Firebase Functions for the PharmaDash Android and iOS apps. These functions handle secure processes such as delivery payment as well as calculating ride statistics.

The newRide function is triggered when a driver starts working and sets up database values for the delivery. The rideUpdate function is triggered when a driver updates his location and calculates the additional distance travelled by the driver. The saveRide function is triggered when a delivery is completed and saves delivery statistics. The payout function is triggered when a driver requests a payout and uses the PayPal SDK to facilitate the payout.
