const functions = require('firebase-functions');
const paypal = require('paypal-rest-sdk');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

paypal.configure({
    mode: 'sandbox',
    client_id: functions.config().paypal.client_id,
    client_secret: functions.config().paypal.client_secret


});

function deg2Rad(deg) {
    return deg * (Math.PI / 180);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // km
    var dLat = deg2Rad(lat2 - lat1);
    var dLon = deg2Rad(lon2 - lon1);
    lat1 = deg2Rad(lat1);
    lat2 = deg2Rad(lat2);

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

exports.saveRide = functions.database.ref('/customerRequest/{pushId}/status').onUpdate((snap, context) => {
    if (snap.after.val() === 4) {
        var customerId = context.params.pushId;
        var driverId;
        var receiptImageUrl;
        var distance;
        var amount;
        var pickupLat;
        var pickupLng;
        var destinationLat;
        var destinationLng;
        var balance;
        var medicine;
        var startTime;

        admin.database().ref('customerRequest/' + customerId).once('value').then((snap) => {
            if (snap !== null) {
                destinationLat = snap.child('l/0').val();
                destinationLng = snap.child('l/1').val();
                pickupLat = snap.child('pickupLat').val();
                pickupLng = snap.child('pickupLng').val();
                distance = snap.child('distance').val();
                amount = snap.child('amount').val();
                receiptImageUrl = snap.child('receiptImageUrl').val();
                startTime = snap.child('startTime').val();
                medicine = snap.child('medicine').val();
                driverId = snap.child('driver').val();

                admin.database().ref('Users/Drivers/' + driverId + '/balance').once('value').then((snap) => {
                    if (snap !== null) {
                        balance = snap.val();

                        var ref = admin.database().ref('history/').push();
                        var key = ref.key;
                        var endTime = Date.now() / 1000.0;

                        admin.database().ref('history/' + key + '/timestamp').set(endTime);
                        admin.database().ref('history/' + key + '/amount').set(amount);
                        admin.database().ref('history/' + key + '/receiptImageUrl').set(receiptImageUrl);
                        admin.database().ref('history/' + key + '/startTime').set(startTime);
                        admin.database().ref('history/' + key + '/distance').set(distance);
                        admin.database().ref('history/' + key + '/rating').set(0);
                        admin.database().ref('history/' + key + '/medicine').set(medicine);
                        admin.database().ref('history/' + key + '/driver').set(driverId);
                        admin.database().ref('history/' + key + '/customer').set(customerId);
                        admin.database().ref('history/' + key + '/location/to/lat').set(destinationLat);
                        admin.database().ref('history/' + key + '/location/to/lng').set(destinationLng);
                        admin.database().ref('history/' + key + '/location/from/lat').set(pickupLat);
                        admin.database().ref('history/' + key + '/location/from/lng').set(pickupLng);
                        admin.database().ref('Users/Drivers/' + driverId + '/history/' + key).set(true);
                        admin.database().ref('Users/Customers/' + customerId + '/history/' + key).set(false);
                        var duration = (endTime - startTime) / 3600;
                        var price = distance * 0.2 + duration * 40;
                        var driverPayout = price * 0.85;
                        admin.database().ref('history/' + key + '/price').set(price);
                        admin.database().ref('history/' + key + '/driverPayout').set(driverPayout);
                        admin.database().ref('Users/Drivers/' + driverId + '/balance').set(balance + driverPayout + amount);
                        admin.database().ref('customerRequest/' + customerId).remove();
                        admin.database().ref('Users/Drivers/' + driverId + "/customerRequest").remove();

                    }
                    return true;
                }).catch((error) => {
                    return console.error(error);
                });
            }
            return true;
        }).catch((error) => {
            return console.error(error);
        });
    }
    return true;
});

exports.rideUpdate = functions.database.ref('/driversWorking/{pushId}/l').onUpdate((change, context) => {
    var driverId = context.params.pushId;
    var beforeLat = change.before.child('0').val();
    var beforeLng = change.before.child('1').val();
    var afterLat = change.after.child('0').val();
    var afterLng = change.after.child('1').val();
    var distance;
    var customerId;

    admin.database().ref('Users/Drivers/' + driverId + '/customerRequest').once('value').then((snap) => {
        if (snap !== null) {
            customerId = snap.val();
            admin.database().ref('customerRequest/' + customerId).once('value').then((snap) => {
                if (snap !== null && customerId !== null) {
                    distance = snap.child('distance').val();
                    distance += calculateDistance(beforeLat, beforeLng, afterLat, afterLng);
                    admin.database().ref('customerRequest/' + customerId + '/distance').set(distance);

                    var status = snap.child('status').val();
                    if (status === 2) {
                        var destinationLat = snap.child('l').child('0').val();
                        var destinationLng = snap.child('l').child('1').val();
                        if (calculateDistance(destinationLat, destinationLng, afterLat, afterLng) <= 0.075) {
                            admin.database().ref('customerRequest/' + customerId + '/status').set(3);
                        }
                    }
                    else if (status === 0) {
                        var pickupLat = snap.child('pickupLat').val();
                        var pickupLng = snap.child('pickupLng').val();
                        if (calculateDistance(afterLat, afterLng, pickupLat, pickupLng) <= 0.075) {
                            console.log('status about to change');
                            admin.database().ref('customerRequest/' + customerId + '/status').set(1);
                        }
                    }
                }
                return true;
            }).catch((error) => {
                return console.error(error);
            });
        }
        return true;
    }).catch((error) => {
        return console.error(error);
    });
    return true;
});

exports.newRide = functions.database.ref('/driversWorking/{pushId}/l').onCreate((snap, context) => {
    var driverId = context.params.pushId;
    var customerId;
    admin.database().ref('Users/Drivers/' + driverId + '/customerRequest').once('value').then((snap) => {
        if (snap !== null) {
            customerId = snap.val();
            var startTime = Date.now() / 1000.0;
            admin.database().ref('customerRequest/' + customerId + '/startTime').set(startTime);
        }
        return true;
    }).catch((error) => {
        return console.error(error);
    });
    return true;
});

function updatePaymentsPending(uid, paymentId) {
    return admin.database().ref('Users/Drivers/' + uid + '/history').once('value').then((snap) => {
        if (snap === null) {
            throw new Error("Profile Doesn't Exist");
        }

        if (snap.hasChildren()) {
            snap.forEach(element => {
                if (element.val() === true) {
                    admin.database().ref('Users/Drivers/' + uid + '/history/' + element.key).set({
                        timestamp: admin.database.ServerValue.TIMESTAMP,
                        paymentId: paymentId
                    });
                    admin.database().ref('history/' + element.key + '/driverPaidOut').set(true);
                }
            });
        }
        return null;
    }).catch((error) => {
        return console.error(error);
    });
}

exports.payout = functions.https.onRequest((request, response) => {
    var driverId = request.body.uid;
    var value;
    admin.database().ref('Users/Drivers/' + driverId + '/balance').once('value').then((snap) => {
        if (snap !== null) {
            value = snap.val();
            var valueTrunc = parseFloat(Math.round(value * 100) / 100).toFixed(2);
            const sender_batch_id = Math.random().toString(36).replace('0.', '');
            const sync_mode = 'false';
            const payReq = JSON.stringify({
                sender_batch_header: {
                    sender_batch_id: sender_batch_id,
                    email_subject: "You have a payment"
                },
                items: [
                    {
                        recipient_type: "EMAIL",
                        amount: {
                            value: valueTrunc,
                            currency: "USD"
                        },
                        receiver: request.body.email,
                        note: "Thank you.",
                        sender_item_id: "item_3"
                    }
                ]
            });
            paypal.payout.create(payReq, sync_mode, (error, payout) => {
                if (error) {
                    console.warn(error.response);
                    response.status('500').end();
                    throw error;
                }
                else {
                    console.info("payout created");
                    console.info(payout);
                    admin.database().ref('Users/Drivers/' + driverId + '/balance').set(0.00);
                    updatePaymentsPending(request.body.uid, sender_batch_id).then(() => {
                        response.status('200').end();
                        return true;
                    }).catch((error) => {
                        return console.error(error);
                    });
                }
            });
        }
        return true;
    }).catch((error) => {
        return console.error(error);
    });

});
