'use strict';

// // Import the Dialogflow module from the Actions on Google client library.
const {dialogflow} = require('actions-on-google');

// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');

// Instantiate the Dialogflow client.
const app = dialogflow({debug: true});

const http = require('http');
const xml2js = require('xml2js');
const moment = require('moment-timezone');

// a. the action name from the make_name Dialogflow intent
const BUS_ACTION = 'get_bus_time';
const WELCOME = 'input.welcome';

const HOST = "webservices.nextbus.com";
const NEXT_BUS_URL = "/service/publicXMLFeed?command=predictions";
const AGENCY = 'bigbluebus';
const ROUTE = '18';
const STOP = '564';
const TIMEZONE = "America/Los_Angeles";

app.intent(BUS_ACTION, (conv) => {
    getNextBusResponse(function (response) {
        conv.close(buildNextBusSentence(response));
    });
});

app.intent(WELCOME, (conv) => {
    getNextBusResponse(function (response) {
        conv.close(buildWelcomeSentence(response));
    });
});

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);

function buildWelcomeSentence(response) {
    if (!response) {
        return "There are no predictions from NextBus at this time. Try again later";
    } else {
        var sentence = "Hello. " + response.routeName + " stops at " + response.stopName +
            " headed toward " + response.direction + ". ";
        sentence += buildNextBusSentence(response);
        return sentence;
    }
}

function buildNextBusSentence(response) {
    console.log("test");
    if (!response || response.predictions.length === 0) {
        return "There are no bus predictions at this time";
    } else {
        var firstPrediction = response.predictions[0];
        var sentence = "Your next bus is in " + firstPrediction.minutes + " minutes at " +
            firstPrediction.time + ".";
        if (response.predictions.length > 1) {
            var secondPrediction = response.predictions[1];
            sentence += " There is another bus in " + secondPrediction.minutes + " minutes at " +
                secondPrediction.time + ".";
        }
        return sentence;
    }
}

function getNextBusResponse(responseCallback) {
    var options = {
        host: HOST,
        port: 80,
        path: NEXT_BUS_URL + "&s=" + STOP + "&r=" + ROUTE + "&a=" + AGENCY,
        method: 'GET'
    };

    http.request(options, function(res) {
        var data = "";
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            data += chunk;
        });

        res.on('end', function() {
            var response = {
                predictions: [],
                routeName: "",
                stopName: "",
                direction: ""
            };
            var parser = new xml2js.Parser();
            parser.parseString(data, function (err, result) {
                if (err) {
                    console.log(err);
                    responseCallback();
                } else {
                    if (!result.body.predictions) {
                        var predictions = result.body.predictions[0].direction[0].prediction;
                        var routeInfo = result.body.predictions[0]['$'];
                        response.routeName = routeInfo.routeTitle;
                        response.stopName = routeInfo.stopTitle;
                        response.direction = result.body.predictions[0].direction[0]['$'].title;
                        for (var predInd in predictions) {
                            var time = moment(Number(predictions[predInd]['$'].epochTime)).tz(TIMEZONE).format('h:mma');
                            var minutes = predictions[predInd]['$'].minutes;

                            var prediction = {
                                time: time,
                                minutes: minutes
                            };
                            response.predictions.push(prediction);
                        }
                        responseCallback(response);
                    }
                }
            });
        });
    }).end();
}