import React, {useState, useContext, useEffect} from 'react';
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

var counter = -1;
let foregroundSubscription = null;
const alertDistance = 100;


function openDatabase(){
  const db = SQLite.openDatabase("test8.db");
  db.transaction((tx) => {
    tx.executeSql(
      "create table if not exists markers (id integer primary key not null, latitude real not null, longitude real not null, images text);"
    );
  });

  return db;
}
const db = openDatabase();


function CheckDistance(markerCoords, position){
  if (position!=null && markerCoords!={}){
    Object.values(markerCoords).map((x)=>{
      const mCoords = {
        latitude:x.latitude,
        longitude:x.longitude
      }
      if (haversine(mCoords, position,{unit:'meter'})<=alertDistance){
        console.log("alert!!");
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
        tx.executeSql("select * from markers", [], (_, {rows}) => console.log(JSON.stringify(rows)));
      }
    );
    setMarkerCoords(res);
  }

  const markerList = Object.values(markerCoords).map((x,i)=> <Marker key={i} coordinate={x} title="Title1" onPress={e=>{
    e.stopPropagation();
    navigation.navigate('Details',{
    markerTarget: i,
    })
  }
  }></Marker>)
  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={startRegion} onPress={addMarker}>
        {markerList}
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
            let imagesDB = x.images.split(",,");
            let marker = {
              imageUris: imagesDB,
              latitude: x.latitude,
              longitude: x.longitude
            }
            res = {...res, [i]:marker};
            counter++;
          });
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
        distanceInterval:3,
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