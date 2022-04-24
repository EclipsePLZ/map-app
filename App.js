import React, {useState, useContext, useEffect, useRef} from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, ScrollView, View, Button, Dimensions, Image, TouchableOpacity} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MapView, { Marker } from 'react-native-maps';
import * as SQLite from 'expo-sqlite';
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import haversine from 'haversine';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async() => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let visitedMarkers = [];
var counter = -1;
let foregroundSubscription = null;
const alertDistance = 200;


function openDatabase(){
  const db = SQLite.openDatabase("test15.db");
  db.transaction((tx) => {
    tx.executeSql(
      "create table if not exists markers (id integer primary key not null, latitude real not null, longitude real not null, images text);"
    );
  });

  return db;
}
const db = openDatabase();


async function CheckDistance(markerCoords, position){
  if (position!=null && markerCoords!={}){
    Object.values(markerCoords).map((x,i)=>{
      if (!visitedMarkers[i]){
        const mCoords = {
          latitude:x.latitude,
          longitude:x.longitude
        }
        const distance = haversine(mCoords, position,{unit:'meter'});
        if (distance <= alertDistance){
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Вы близки к маркеру "+(i+1),
              body: "Расстояние до маркера "+(i+1)+" примерно - "+Math.round(distance)+" м.",
              data: {data: 'goes here'},
            },
            trigger: {seconds: 2},
          });
          console.log("alert!!");
        }
        visitedMarkers[i] = true;
      }
    });
  }
}

function HomeScreen({ navigation }) {
  const startRegion = {
    latitude: 58.006948,
    longitude: 56.238385,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }

  const [markerCoords,setMarkerCoords,position] = useContext(MyContext);
  CheckDistance(markerCoords, position);

  const addMarker = (e) => {
    let newMarker = {
      imageUris: [],
      ...e.nativeEvent.coordinate
    }
    counter++;
    let res = {...markerCoords, [counter]:newMarker};
    db.transaction(
      (tx) => {
        tx.executeSql("insert into markers (id, latitude, longitude, images) values (?, ?, ?, ?)", [counter, newMarker.latitude, newMarker.longitude, ""]);
      }
    );
    visitedMarkers = [...visitedMarkers, false];
    setMarkerCoords(res);
  }

  const markerList = Object.values(markerCoords).map((x,i)=> <Marker key={i} coordinate={x} title={"Marker "+(i+1)} onPress={e=>{
    e.stopPropagation();
    navigation.navigate('Details',{
    markerTarget: i,
    })
  }
  }></Marker>)
  
  let myMarker;
  if (position != null){
    myMarker = <Marker coordinate={position} titlt="Me" pinColor='blue'/>
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={startRegion} onPress={addMarker}>
        {markerList}
        {myMarker}
      </MapView>
    </View>
  );
}

function DetailsScreen({ route, navigation }) {
  const [markerCoords,setMarkerCoords] = useContext(MyContext);
  const {markerTarget} = route.params;

  const openImagePicker = async() => {
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false){
      alert("Требуется доступ к фотогалерее!");
      return;
    }

    let pickerResult = await ImagePicker.launchImageLibraryAsync();
    if (pickerResult.cancelled === true){
      return;
    }

    let res={};
    Object.values(markerCoords).map((x,i)=>{
      if (i===markerTarget){
        let marker = markerCoords[i];
        let images = [...marker.imageUris, pickerResult.uri];
        let newMarker = {
          imageUris: images,
          latitude: marker.latitude,
          longitude: marker.longitude
        }
        let imagesText = "";
        images.map((x, i) => {imagesText+=x+",,";});
        imagesText = imagesText.slice(0,-2);
        console.log(imagesText);
        db.transaction(
          (tx) => {
            tx.executeSql("update markers set images = ? where id = ?", [imagesText, i]);
          }
        );
        res = {...res, [i]:newMarker};
      }
      else{
        res = {...res, [i]:x};
      }
    });
    setMarkerCoords(res);
  }

  const imageList = markerCoords[markerTarget].imageUris.map((x,i)=><Image key={i} source={{uri: x}} style={styles.thumbnail}/>);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={openImagePicker} style={styles.button}>
        <Text style={styles.buttonText}>Загрузить фото</Text>
      </TouchableOpacity>
      <ScrollView>
        {imageList}
      </ScrollView>
    </View>
  );
}

const Stack = createNativeStackNavigator();
const MyContext = React.createContext();


export default function App() {

  const initialMarkerCoords = () => {
    let res = {};
    db.transaction(
      (tx) => {
        tx.executeSql("select * from markers", [], (_, {rows: {_array} }) => {
          _array.map((x,i) => {
            visitedMarkers = [...visitedMarkers, false];
            let imagesDB = x.images.split(",,");
            let marker = {
              imageUris: imagesDB,
              latitude: x.latitude,
              longitude: x.longitude
            }
            res = {...res, [i]:marker};
            counter++;
          });
          console.log(counter);
          setMarkers(res);
        });
      }
    );
    return res;
  }

  const [markers, setMarkers] = useState(initialMarkerCoords);

  useEffect(()=>{
    const requestPermissions = async() => {
      const foreground = await Location.requestForegroundPermissionsAsync();
    }
    requestPermissions()
  }, []);

  const [position, setPosition] = useState(null);

  const startForegroundUpdate = async() =>{
    const {granted} = await Location.getForegroundPermissionsAsync();
    if (!granted){
      console.log("location tracking denied");
      return;
    }
    const haversine = require('haversine');
    foregroundSubscription?.remove();
    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval:2,
      },
      location => {
        setPosition(location.coords);
      }
    );
  }

  const stopForegroundUpdate = () => {
    foregroundSubscription?.remove();
    setPosition(null);
  }

  useEffect(()=>{
    startForegroundUpdate();
  },[]);

  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));
  }, []);

  return (
    <MyContext.Provider  value={[markers, setMarkers, position]}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Details" component={DetailsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </MyContext.Provider>
  );
}

async function registerForPushNotificationsAsync(){
  let token;
  if (Constants.isDevice){
    const {status: existingStatus} = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted'){
      const {status} = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted'){
      alert('Failed to get push token for push notification!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
  }
  else{
    aler('Must use physical device for Push Notifications');
  }
  return token;
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  button:{
    backgroundColor:"blue",
    marginTop: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 5,
  },
  buttonText:{
    fontSize: 20,
    color: '#fff',
  },
  thumbnail:{
    width: 300,
    height: 300,
    marginBottom: 10,
  }
});