const express = require('express')
const path = require('path')
const fs = require('fs')
const bodyParser = require("body-parser")
const MongoClient = require('mongodb').MongoClient;
const PORT = process.env.PORT || 3000;

//import expo client sdk
const { Expo } = require('expo-server-sdk')

app = express();

let applicationProperties = fs.readFileSync('properties.json');  
let props = JSON.parse(applicationProperties);  

// mongodb configuration
const mongoUrl  = props.mongoServer;
const dbName = props.mongoDb;

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// function rest api
const login = async(req,res) => { 
    console.log("req : ",req);
    console.log("body : ",req.body);     
    var username = req.body.username;
    var password = req.body.password;
    let mongod =  await MongoClient.connect(mongoUrl)
    var responseJson = {};    
    let collection = await mongod.db(dbName)
    .collection("user").findOne({$and:[{username:username},{password:password}]});      
    console.log('collection :', collection)    
    if(collection){
      responseJson['data'] = collection
      responseJson['status'] = 'OK'
    }else{
      responseJson['data'] = 'user not found'
      responseJson['status'] = 'ERROR'
    }
    res.send(responseJson)
    
}

const sendNotifcation = async(req,res) => { 
  console.log("body : ",req.body);     
  let token = req.body.token;
  let notifTitle = 'order';
  let notifDescription = req.body.description;
  let data = req.body.data;

  //test push notif
  let expo = new Expo();

  // Create the messages that you want to send to clents
  let messages = [];
  pushToken = token;
  if(!Expo.isExpoPushToken(pushToken)){
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    
  } else{
    messages.push({
      to: pushToken,
      title: notifTitle,
      body : notifDescription,
      sound: 'default',
      badge:1,
      data: { withSome: 'data' },
    })
  }

console.log('messages : ', messages);

let chunks = expo.chunkPushNotifications(messages);
let tickets = [];
(async () => {
  // Send the chunks to the Expo push notification service. There are
  // different strategies you could use. A simple one is to send one chunk at a
  // time, which nicely spreads the load out over time:
  for (let chunk of chunks) {
    try {
      let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log('chunking ...');
      console.log(ticketChunk);
      tickets.push(...ticketChunk);
      // NOTE: If a ticket contains an error code in ticket.details.error, you
      // must handle it appropriately. The error codes are listed in the Expo
      // documentation:
      // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
    } catch (error) {
      console.error(error);
    }
  }
})();

let receiptIds = [];
for (let ticket of tickets) {
  // NOTE: Not all tickets have IDs; for example, tickets for notifications
  // that could not be enqueued will have error information and no receipt ID.
  if (ticket.id) {
    receiptIds.push(ticket.id);
  }
}

let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
(async () => {
  // Like sending notifications, there are different strategies you could use
  // to retrieve batches of receipts from the Expo service.
  for (let chunk of receiptIdChunks) {
    try {
      let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      console.log(receipts);


      // The receipts specify whether Apple or Google successfully received the
      // notification and information about an error, if one occurred.
      for (let receipt of receipts) {
        
        if (receipt.status === 'ok') {
          continue;
        } else if (receipt.status === 'error') {
          console.error(`There was an error sending a notification: ${receipt.message}`);
          if (receipt.details && receipt.details.error) {
            // The error codes are listed in the Expo documentation:
            // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
            // You must handle the errors appropriately.
            console.error(`The error code is ${receipt.details.error}`);
          }
        }
      }
      res.send(receipts)
    } catch (error) {
      console.error(error);
    }
  }
})();
}


app.post('/login',login)
app.post('/send-notification',sendNotifcation)


app.use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => {
  	res.send("server is running on port " + PORT)
  })
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))





