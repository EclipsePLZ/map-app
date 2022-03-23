import React, {useState, useContext} from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, Dimensions, Image, TouchableOpacity} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MapView, { Marker } from 'react-native-maps';

var counter = -1;
const initialMarkerCoords = {
// 0: {
//   latitude: 58.006948,
//   longitude: 56.238385,
//   },
// 1: {
//   latitude: 58.056948,
//   longitude: 56.248385,
//   }
}


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
    setMarkerCoords(res)
  }

  const markerList = Object.values(markerCoords).map((x,i)=> <Marker key={i} coordinate={x} title="Title1" onPress={e=>{
    e.stopPropagation();
    navigation.navigate('Details',{
    markerTarget: x,
    })
  }
  }></Marker>)
  console.log(markerCoords);
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

  let openImagePicker = async() => {
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
      if (x===markerTarget){
        let images = [...x.imageUris, pickerResult.uri];
        let newMarker = {
          imageUris: images,
          latitude: markerTarget.latitude,
          longitude: markerTarget.longitude
        }
        res = {...res, [i]:newMarker};
      }
      else{
        res = {...res, [i]:x}
      }
    });
    setMarkerCoords(res);

  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={openImagePicker} style={styles.button}>
        <Text style={styles.buttonText}>Загрузить фото</Text>
      </TouchableOpacity>
      <StatusBar style="auto"/>
    </View>
  );
}

const Stack = createNativeStackNavigator();
const MyContext = React.createContext();
export default function App() {
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
    padding: 20,
    borderRadius: 5,
  },
  buttonText:{
    fontSize: 20,
    color: '#fff',
  },
  instructions:{
    color: '#888',
    fontSize: 18,
    marginHorizontal: 15,
  },
});