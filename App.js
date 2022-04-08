import React, {useState, useContext} from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, ScrollView, View, Button, Dimensions, Image, TouchableOpacity} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MapView, { Marker } from 'react-native-maps';
import * as SQLite from 'expo-sqlite';
import { useEffect } from 'react/cjs/react.production.min';

var counter = -1;

function openDatabase(){
  const db = SQLite.openDatabase("test1.db");
  db.transaction((tx) => {
    tx.executeSql(
      "create table if not exists markers (id integer primary key not null, latitude real not null, longitude real not null, images text);"
    );
  });

  return db;
}
const db = openDatabase();



function HomeScreen({ navigation }) {
  const startRegion = {
    latitude: 58.006948,
    longitude: 56.238385,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }

  const [markerCoords,setMarkerCoords] = useContext(MyContext);

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
    //console.log(db);
    setMarkerCoords(res)
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
        db.transaction(
          (tx) => {
            tx.executeSql("update markers set images = ? where id = ?", [images, i]);
            tx.executeSql("select * from markers", [], (_, {rows}) => console.log(JSON.stringify(rows)));
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
            let marker = {
              imageUris: x.images,
              latitude: x.latitude,
              longitude: x.longitude
            }
            res = {...res, [i]:marker};
            counter++;
          });
          setState(res);
        });
      }
    );
    return res;
  }

  const [state, setState] = useState(initialMarkerCoords);
  
  return (
    <MyContext.Provider value={[state, setState]}>
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